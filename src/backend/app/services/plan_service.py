import io
from time import perf_counter
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np
from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.config import settings
from app.adaptation import engine as adaptation_engine
from app.models.plan_record import PlanRecord
from app.processing.pipeline import process_floor_plan
from app.schemas.plan import Dimensions, PlanDetail, StructuralPlan, UploadResult


class UploadValidationError(ValueError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class PlanNotFoundError(LookupError):
    pass


class PlanService:
    def __init__(self, session: Session):
        self.session = session

    async def upload(self, file: UploadFile) -> UploadResult:
        extension = Path(file.filename or "").suffix.lower()
        if extension not in settings.allowed_extensions:
            raise UploadValidationError("Only .png, .jpg, and .jpeg files are accepted.")

        content = await file.read(settings.max_upload_bytes + 1)
        if not content:
            raise UploadValidationError("The uploaded file is empty.")
        if len(content) > settings.max_upload_bytes:
            raise UploadValidationError("The uploaded file exceeds the 10 MB size limit.", 413)

        image_format, _, _ = self._validate_image(content, extension)
        image = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise UploadValidationError("The file could not be decoded as an image.")

        plan_id = str(uuid4())
        stored_extension = ".png" if image_format == "PNG" else ".jpg"
        storage_path = settings.uploads_dir / f"{plan_id}{stored_extension}"
        storage_path.write_bytes(content)

        try:
            adaptation_engine.knowledge.enhanced_retry_count = 0
            started = perf_counter()
            used_enhanced_retry = False
            try:
                structure = process_floor_plan(image, plan_id, settings.debug_dir / plan_id)
            except Exception:
                adaptation_engine.monitor.record_processing((perf_counter() - started) * 1000, failed=True)
                adaptation_engine.evaluate()
                structure = process_floor_plan(image, plan_id, settings.debug_dir / plan_id, enhanced=True)
                used_enhanced_retry = True
                adaptation_engine.knowledge.enhanced_retry_count = 1
            adaptation_engine.monitor.record_processing((perf_counter() - started) * 1000, structure.overall_confidence)
            _, _, decision, _ = adaptation_engine.evaluate()
            if decision.strategy.value == "RETRY_ENHANCED_PREPROCESSING" and not used_enhanced_retry:
                enhanced = process_floor_plan(image, plan_id, settings.debug_dir / plan_id, enhanced=True)
                if enhanced.overall_confidence >= structure.overall_confidence:
                    structure = enhanced
                adaptation_engine.monitor.record_processing((perf_counter() - started) * 1000, structure.overall_confidence)
                adaptation_engine.evaluate()
            record = PlanRecord(id=plan_id, original_name=Path(file.filename or "upload").name[:255], media_type="image/png" if image_format == "PNG" else "image/jpeg", size_bytes=len(content), storage_path=str(storage_path), structure=structure.model_dump(mode="json"))
            self.session.add(record)
            self.session.commit()
        except Exception:
            adaptation_engine.monitor.record_processing((perf_counter() - started) * 1000, failed=True)
            adaptation_engine.evaluate()
            storage_path.unlink(missing_ok=True)
            raise

        return UploadResult(plan=self._detail(record), structure=structure)

    def get_plan(self, plan_id: str) -> PlanDetail:
        return self._detail(self._get_record(plan_id))

    def get_structure(self, plan_id: str) -> StructuralPlan:
        return StructuralPlan.model_validate(self._get_record(plan_id).structure)

    def save_structure(self, plan_id: str, structure: StructuralPlan) -> StructuralPlan:
        if structure.id != plan_id:
            raise UploadValidationError("Structure ID must match the requested plan ID.", 409)
        record = self._get_record(plan_id)
        updated = structure.model_copy(update={
            "editing_metadata": structure.editing_metadata.model_copy(update={
                "revision": structure.editing_metadata.revision + 1,
                "modified_by": "manual",
                "last_saved_at": datetime.now(timezone.utc),
            })
        })
        record.structure = updated.model_dump(mode="json")
        self.session.commit()
        self.session.refresh(record)
        return updated

    def get_artifact(self, plan_id: str, artifact_name: str) -> Path:
        self._get_record(plan_id)
        allowed_artifacts = {"threshold", "cleaned", "edges"}
        if artifact_name not in allowed_artifacts:
            raise UploadValidationError("Unknown processing artifact.")
        path = settings.debug_dir / plan_id / f"{artifact_name}.png"
        if not path.is_file():
            raise PlanNotFoundError(f"Artifact {artifact_name} was not found.")
        return path

    def _get_record(self, plan_id: str) -> PlanRecord:
        record = self.session.get(PlanRecord, plan_id)
        if record is None:
            raise PlanNotFoundError(f"Plan {plan_id} was not found.")
        return record

    @staticmethod
    def _detail(record: PlanRecord) -> PlanDetail:
        structure = StructuralPlan.model_validate(record.structure)
        return PlanDetail(id=record.id, original_name=record.original_name, media_type=record.media_type, size_bytes=record.size_bytes, status=record.status, created_at=record.created_at, overall_confidence=structure.overall_confidence, source_dimensions=Dimensions(**structure.source_dimensions.model_dump()))

    @staticmethod
    def _validate_image(content: bytes, extension: str) -> tuple[str, int, int]:
        try:
            with Image.open(io.BytesIO(content)) as image:
                image.verify()
            with Image.open(io.BytesIO(content)) as image:
                image_format = image.format or ""
                width, height = image.size
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise UploadValidationError("The uploaded file is not a valid image.") from exc

        allowed_formats = {".png": {"PNG"}, ".jpg": {"JPEG"}, ".jpeg": {"JPEG"}}
        if image_format not in allowed_formats[extension]:
            raise UploadValidationError("The file content does not match its extension.")
        if width < 32 or height < 32:
            raise UploadValidationError("Image dimensions must be at least 32 by 32 pixels.")
        if width * height > settings.max_image_pixels:
            raise UploadValidationError("The image dimensions exceed the 25 megapixel limit.", 413)
        return image_format, width, height
