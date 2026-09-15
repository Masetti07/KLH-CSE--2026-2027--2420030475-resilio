from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


RoomType = Literal["living_room", "kitchen", "master_bedroom", "bedroom", "bathroom", "dining", "study", "pooja_room", "entrance", "utility", "other"]


class Point(BaseModel):
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)


class Dimensions(BaseModel):
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class NormalizedDimensions(BaseModel):
    width: float = Field(default=1.0, ge=0.0, le=1.0)
    height: float = Field(default=1.0, ge=0.0, le=1.0)


class Wall(BaseModel):
    id: str
    start_x: float = Field(ge=0.0, le=1.0)
    start_y: float = Field(ge=0.0, le=1.0)
    end_x: float = Field(ge=0.0, le=1.0)
    end_y: float = Field(ge=0.0, le=1.0)
    thickness: float = Field(gt=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)

    @model_validator(mode="after")
    def reject_zero_length(self) -> "Wall":
        if abs(self.start_x - self.end_x) < 1e-6 and abs(self.start_y - self.end_y) < 1e-6:
            raise ValueError("wall endpoints must not be identical")
        return self


class Room(BaseModel):
    id: str
    polygon: list[Point] = Field(min_length=3)
    name: str | None = None
    type: RoomType | None = None
    confidence: float = Field(ge=0.0, le=1.0)


class Opening(BaseModel):
    id: str
    wall_id: str | None = None
    position: Point
    width: float = Field(gt=0.0, le=0.5)
    probable_type: Literal["door", "window", "unknown"]
    confidence: float = Field(ge=0.0, le=1.0)


class ProcessingMetadata(BaseModel):
    pipeline_version: str
    stages: list[str]
    warnings: list[str] = Field(default_factory=list)
    debug_images: dict[str, str] = Field(default_factory=dict)


class EditingMetadata(BaseModel):
    revision: int = Field(default=0, ge=0)
    modified_by: Literal["automatic", "manual"] = "automatic"
    last_saved_at: datetime | None = None


class StructuralPlan(BaseModel):
    id: str
    source_dimensions: Dimensions
    normalized_dimensions: NormalizedDimensions
    overall_confidence: float = Field(ge=0.0, le=1.0)
    processing_metadata: ProcessingMetadata
    editing_metadata: EditingMetadata = Field(default_factory=EditingMetadata)
    wall_height: float = Field(default=3.0, ge=0.5, le=10.0)
    walls: list[Wall] = Field(default_factory=list)
    rooms: list[Room] = Field(default_factory=list)
    openings: list[Opening] = Field(default_factory=list)

    @field_validator("walls")
    @classmethod
    def unique_wall_ids(cls, walls: list[Wall]) -> list[Wall]:
        if len({wall.id for wall in walls}) != len(walls):
            raise ValueError("wall IDs must be unique")
        return walls

    @model_validator(mode="after")
    def validate_structural_references(self) -> "StructuralPlan":
        if len({room.id for room in self.rooms}) != len(self.rooms):
            raise ValueError("room IDs must be unique")
        if len({opening.id for opening in self.openings}) != len(self.openings):
            raise ValueError("opening IDs must be unique")
        wall_ids = {wall.id for wall in self.walls}
        invalid = [opening.id for opening in self.openings if opening.wall_id and opening.wall_id not in wall_ids]
        if invalid:
            raise ValueError(f"openings reference unknown walls: {', '.join(invalid)}")
        return self


class PlanDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_name: str
    media_type: str
    size_bytes: int
    status: str
    created_at: datetime
    overall_confidence: float
    source_dimensions: Dimensions


class UploadResult(BaseModel):
    plan: PlanDetail
    structure: StructuralPlan
