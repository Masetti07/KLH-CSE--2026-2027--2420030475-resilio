from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database.session import get_session
from app.schemas.design import DesignCreate, DesignDetail, DesignDuplicate, DesignUpdate, VastuAnalysis, VastuAssistPreview, VastuAssistRequest
from app.services.design_service import DesignNotFoundError, DesignService, DesignValidationError
from app.services.vastu import VASTU_RULES, analyze_design


router = APIRouter(tags=["designs"])


@router.post("/api/vastu/assist-preview", response_model=VastuAssistPreview)
def vastu_assist_preview(payload: VastuAssistRequest) -> VastuAssistPreview:
    return VastuAssistPreview(analysis=analyze_design("preview", payload.configuration, payload.structure), rules=list(VASTU_RULES))


def service(session: Session = Depends(get_session)) -> DesignService:
    return DesignService(session)


def translate_error(exc: Exception) -> HTTPException:
    if isinstance(exc, DesignNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, DesignValidationError):
        return HTTPException(status_code=exc.status_code, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


@router.get("/api/plans/{plan_id}/designs", response_model=list[DesignDetail])
def list_designs(plan_id: UUID, design_service: DesignService = Depends(service)) -> list[DesignDetail]:
    try:
        return design_service.list_designs(str(plan_id))
    except (DesignNotFoundError, DesignValidationError) as exc:
        raise translate_error(exc) from exc


@router.post("/api/plans/{plan_id}/designs", response_model=DesignDetail, status_code=status.HTTP_201_CREATED)
def create_design(plan_id: UUID, payload: DesignCreate, design_service: DesignService = Depends(service)) -> DesignDetail:
    try:
        return design_service.create_design(str(plan_id), payload)
    except (DesignNotFoundError, DesignValidationError) as exc:
        raise translate_error(exc) from exc


@router.get("/api/designs/{design_id}", response_model=DesignDetail)
def get_design(design_id: UUID, design_service: DesignService = Depends(service)) -> DesignDetail:
    try:
        return design_service.get_design(str(design_id))
    except DesignNotFoundError as exc:
        raise translate_error(exc) from exc


@router.put("/api/designs/{design_id}", response_model=DesignDetail)
def update_design(design_id: UUID, payload: DesignUpdate, design_service: DesignService = Depends(service)) -> DesignDetail:
    try:
        return design_service.update_design(str(design_id), payload)
    except (DesignNotFoundError, DesignValidationError) as exc:
        raise translate_error(exc) from exc


@router.post("/api/designs/{design_id}/duplicate", response_model=DesignDetail, status_code=status.HTTP_201_CREATED)
def duplicate_design(design_id: UUID, payload: DesignDuplicate, design_service: DesignService = Depends(service)) -> DesignDetail:
    try:
        return design_service.duplicate_design(str(design_id), payload)
    except (DesignNotFoundError, DesignValidationError) as exc:
        raise translate_error(exc) from exc


@router.delete("/api/designs/{design_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_design(design_id: UUID, design_service: DesignService = Depends(service)) -> Response:
    try:
        design_service.delete_design(str(design_id))
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except DesignNotFoundError as exc:
        raise translate_error(exc) from exc


@router.post("/api/designs/{design_id}/vastu-analysis", response_model=VastuAnalysis)
def vastu_analysis(design_id: UUID, design_service: DesignService = Depends(service)) -> VastuAnalysis:
    try:
        return design_service.analyze(str(design_id))
    except (DesignNotFoundError, DesignValidationError) as exc:
        raise translate_error(exc) from exc
