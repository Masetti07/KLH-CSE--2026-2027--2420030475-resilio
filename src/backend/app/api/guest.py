"""Stateless guest computation. Never opens a database session or accepts record IDs."""
import base64
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.api.plans import get_sample
from app.config import settings
from app.processing.pipeline import process_floor_plan
from app.schemas.design import VastuAssistRequest, VastuAssistPreview
from app.schemas.plan import StructuralPlan
from app.services.plan_service import PlanService, UploadValidationError
from app.services.starter_plans import BlankDimensions, STARTER_NAMES, StarterKind, make_starter_plan
from app.services.vastu import VASTU_RULES, analyze_design

router = APIRouter(prefix="/api/guest", tags=["public-guest"])
router.get("/samples/{name}")(get_sample)


def bounded(structure: StructuralPlan) -> StructuralPlan:
    if (len(structure.walls) > 1000 or len(structure.rooms) > 100 or len(structure.openings) > 500
            or any(len(room.polygon) > 256 for room in structure.rooms)):
        raise HTTPException(413, "Plan geometry exceeds the public demo limits.")
    return structure


def result(structure: StructuralPlan, name: str, media_type: str, size: int) -> dict:
    return {"plan": {"id": structure.id, "original_name": name, "media_type": media_type,
                     "size_bytes": size, "status": "processed", "overall_confidence": structure.overall_confidence,
                     "created_at": datetime.now(timezone.utc).isoformat(),
                     "source_dimensions": structure.source_dimensions.model_dump()},
            "structure": bounded(structure).model_dump(mode="json")}


@router.post("/starters/{kind}")
def starter(kind: StarterKind, dimensions: BlankDimensions | None = None):
    if kind != "blank" and dimensions is not None:
        raise HTTPException(400, "Dimensions are only supported for a blank plan.")
    return result(make_starter_plan(kind, str(uuid4()), dimensions), STARTER_NAMES[kind],
                  "application/x-resiliospace-starter", 0)


def process(content: bytes, filename: str, extension: str) -> dict:
    try:
        image_format, width, height = PlanService._validate_image(content, extension)
    except UploadValidationError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    if width * height > 4_000_000:
        raise HTTPException(413, "Public demo images must be at most 4 megapixels.")
    image = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "The file could not be decoded as an image.")
    # Per-request temporary files are cleaned on success and failure; no upload is retained.
    with TemporaryDirectory(prefix="resiliospace-guest-") as temporary:
        debug = Path(temporary) / "debug" / str(uuid4())
        try:
            structure = process_floor_plan(image, str(uuid4()), debug)
        except Exception as exc:
            raise HTTPException(422, "This plan could not be reconstructed. Try a supported sample or starter.") from exc
        artifacts = {name: "data:image/png;base64," + base64.b64encode((debug / f"{name}.png").read_bytes()).decode()
                     for name in ("threshold", "cleaned", "edges") if (debug / f"{name}.png").is_file()}
        structure.processing_metadata.debug_images = {name: "browser-local" for name in artifacts}
        payload = result(structure, filename, "image/png" if image_format == "PNG" else "image/jpeg", len(content))
        return {**payload, "artifacts": artifacts}


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    extension = Path(file.filename or "").suffix.lower()
    if extension not in settings.allowed_extensions:
        raise HTTPException(400, "Only .png, .jpg, and .jpeg files are accepted.")
    content = await file.read(settings.max_upload_bytes + 1)
    if not content or len(content) > settings.max_upload_bytes:
        raise HTTPException(413 if content else 400, "Upload must contain an image no larger than 10 MB.")
    return await run_in_threadpool(process, content, Path(file.filename or "upload").name[:255], extension)


@router.post("/structure", response_model=StructuralPlan)
def validate_structure(structure: StructuralPlan):
    return bounded(structure)


@router.post("/analysis", response_model=VastuAssistPreview)
def analysis(payload: VastuAssistRequest):
    bounded(payload.structure)
    return VastuAssistPreview(analysis=analyze_design("browser-local", payload.configuration, payload.structure),
                              rules=list(VASTU_RULES))
