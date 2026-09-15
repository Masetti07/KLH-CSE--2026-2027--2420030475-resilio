from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.session import get_session
from app.schemas.plan import PlanDetail, StructuralPlan, UploadResult
from app.services.plan_service import ControlledProcessingFailure, PlanNotFoundError, PlanService, UploadValidationError


router = APIRouter(prefix="/api/plans", tags=["plans"])


def service(session: Session = Depends(get_session)) -> PlanService:
    return PlanService(session)


@router.post("/upload", response_model=UploadResult, status_code=status.HTTP_201_CREATED)
async def upload_plan(file: UploadFile = File(...), plan_service: PlanService = Depends(service)) -> UploadResult:
    try:
        return await plan_service.upload(file)
    except UploadValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except ControlledProcessingFailure as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/{plan_id}", response_model=PlanDetail)
def get_plan(plan_id: UUID, plan_service: PlanService = Depends(service)) -> PlanDetail:
    try:
        return plan_service.get_plan(str(plan_id))
    except PlanNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{plan_id}/structure", response_model=StructuralPlan)
def get_structure(plan_id: UUID, plan_service: PlanService = Depends(service)) -> StructuralPlan:
    try:
        return plan_service.get_structure(str(plan_id))
    except PlanNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/{plan_id}/structure", response_model=StructuralPlan)
def save_structure(plan_id: UUID, structure: StructuralPlan, plan_service: PlanService = Depends(service)) -> StructuralPlan:
    try:
        return plan_service.save_structure(str(plan_id), structure)
    except PlanNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except UploadValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/{plan_id}/artifacts/{artifact_name}", response_class=FileResponse)
def get_processing_artifact(plan_id: UUID, artifact_name: str, plan_service: PlanService = Depends(service)) -> FileResponse:
    try:
        path = plan_service.get_artifact(str(plan_id), artifact_name)
        return FileResponse(path, media_type="image/png")
    except PlanNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except UploadValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
