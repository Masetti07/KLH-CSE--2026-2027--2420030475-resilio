from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.design_record import DesignRecord
from app.models.plan_record import PlanRecord
from app.schemas.design import (
    DesignConfiguration, DesignCreate, DesignDetail, DesignDuplicate, DesignUpdate,
    DoorConfiguration, FloorAppearance, RoomSemantic, VastuAnalysis, WallAppearance, WindowConfiguration,
)
from app.schemas.plan import StructuralPlan
from app.services.vastu import analyze_design
from app.observability import VASTU_ANALYSES


class DesignNotFoundError(LookupError):
    pass


class DesignValidationError(ValueError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class DesignService:
    def __init__(self, session: Session):
        self.session = session

    def list_designs(self, plan_id: str) -> list[DesignDetail]:
        self._plan(plan_id)
        records = self.session.scalars(select(DesignRecord).where(DesignRecord.plan_id == plan_id).order_by(DesignRecord.created_at)).all()
        return [self._detail(record) for record in records]

    def create_design(self, plan_id: str, payload: DesignCreate) -> DesignDetail:
        plan = self._plan(plan_id)
        structure = StructuralPlan.model_validate(plan.structure)
        configuration = payload.configuration or self.default_configuration(structure)
        self._validate_references(configuration, structure)
        existing_count = len(self.session.scalars(select(DesignRecord.id).where(DesignRecord.plan_id == plan_id)).all())
        record = DesignRecord(id=str(uuid4()), plan_id=plan_id, name=payload.name or f"Design {existing_count + 1}", configuration=configuration.model_dump(mode="json"))
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return self._detail(record)

    def get_design(self, design_id: str) -> DesignDetail:
        return self._detail(self._record(design_id))

    def update_design(self, design_id: str, payload: DesignUpdate) -> DesignDetail:
        record = self._record(design_id)
        if payload.configuration is not None:
            structure = StructuralPlan.model_validate(self._plan(record.plan_id).structure)
            self._validate_references(payload.configuration, structure)
            record.configuration = payload.configuration.model_dump(mode="json")
            record.latest_analysis = None
        if payload.name is not None:
            record.name = payload.name
        record.updated_at = datetime.now(timezone.utc)
        self.session.commit()
        self.session.refresh(record)
        return self._detail(record)

    def duplicate_design(self, design_id: str, payload: DesignDuplicate) -> DesignDetail:
        source = self._record(design_id)
        count = len(self.session.scalars(select(DesignRecord.id).where(DesignRecord.plan_id == source.plan_id)).all())
        record = DesignRecord(id=str(uuid4()), plan_id=source.plan_id, name=payload.name or f"Design {count + 1}", configuration=deepcopy(source.configuration))
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return self._detail(record)

    def delete_design(self, design_id: str) -> None:
        record = self._record(design_id)
        self.session.delete(record)
        self.session.commit()

    def analyze(self, design_id: str) -> VastuAnalysis:
        record = self._record(design_id)
        structure = StructuralPlan.model_validate(self._plan(record.plan_id).structure)
        configuration = DesignConfiguration.model_validate(record.configuration)
        analysis = analyze_design(record.id, configuration, structure)
        VASTU_ANALYSES.inc()
        record.latest_analysis = analysis.model_dump(mode="json")
        record.updated_at = datetime.now(timezone.utc)
        self.session.commit()
        return analysis

    @staticmethod
    def default_configuration(structure: StructuralPlan) -> DesignConfiguration:
        return DesignConfiguration(
            wall_height=structure.wall_height,
            wall_appearances={wall.id: WallAppearance() for wall in structure.walls},
            floor_appearances={room.id: FloorAppearance() for room in structure.rooms},
            door_configurations={opening.id: DoorConfiguration(width=opening.width) for opening in structure.openings if opening.probable_type == "door"},
            window_configurations={opening.id: WindowConfiguration(width=opening.width) for opening in structure.openings if opening.probable_type == "window"},
            room_semantics={room.id: RoomSemantic(name=room.name, room_type=room.type) for room in structure.rooms},
            orientation=None,
        )

    @staticmethod
    def _validate_references(configuration: DesignConfiguration, structure: StructuralPlan) -> None:
        wall_ids = {wall.id for wall in structure.walls}
        room_ids = {room.id for room in structure.rooms}
        opening_ids = {opening.id for opening in structure.openings}
        invalid_walls = set(configuration.wall_appearances) - wall_ids
        invalid_rooms = (set(configuration.floor_appearances) | set(configuration.room_semantics)) - room_ids
        invalid_openings = (set(configuration.door_configurations) | set(configuration.window_configurations)) - opening_ids
        if invalid_walls or invalid_rooms or invalid_openings:
            raise DesignValidationError("Design configuration references structural elements that do not exist.", 409)

    def _plan(self, plan_id: str) -> PlanRecord:
        record = self.session.get(PlanRecord, plan_id)
        if record is None:
            raise DesignNotFoundError(f"Plan {plan_id} was not found.")
        return record

    def _record(self, design_id: str) -> DesignRecord:
        record = self.session.get(DesignRecord, design_id)
        if record is None:
            raise DesignNotFoundError(f"Design {design_id} was not found.")
        return record

    @staticmethod
    def _detail(record: DesignRecord) -> DesignDetail:
        return DesignDetail(
            id=record.id, plan_id=record.plan_id, name=record.name,
            configuration=DesignConfiguration.model_validate(record.configuration),
            latest_analysis=VastuAnalysis.model_validate(record.latest_analysis) if record.latest_analysis else None,
            created_at=record.created_at, updated_at=record.updated_at,
        )
