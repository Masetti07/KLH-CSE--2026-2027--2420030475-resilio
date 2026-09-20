from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.plan import Point, RoomType, StructuralPlan


Orientation = Literal[0, 90, 180, 270]
Zone = Literal["north", "north_east", "east", "south_east", "south", "south_west", "west", "north_west", "center"]
RuleResultState = Literal["satisfied", "unsatisfied", "not_applicable", "cannot_evaluate"]


class WallAppearance(BaseModel):
    color: str = Field(default="#eee9de", pattern=r"^#[0-9a-fA-F]{6}$")
    finish: Literal["paint", "wood_panel", "brick_style", "concrete_style"] = "paint"


class FloorAppearance(BaseModel):
    color: str = Field(default="#e8e1d4", pattern=r"^#[0-9a-fA-F]{6}$")
    finish: Literal["wood", "tile", "marble_style", "concrete", "neutral"] = "neutral"


class DoorConfiguration(BaseModel):
    color: str = Field(default="#8b4d28", pattern=r"^#[0-9a-fA-F]{6}$")
    width: float = Field(gt=0.0, le=0.5)
    style: Literal["standard", "sliding", "double"] = "standard"


class WindowConfiguration(BaseModel):
    color: str = Field(default="#67b9dc", pattern=r"^#[0-9a-fA-F]{6}$")
    width: float = Field(gt=0.0, le=0.5)
    height: float = Field(default=1.1, ge=0.4, le=4.5)
    style: Literal["standard", "wide", "floor_to_ceiling"] = "standard"


class RoomSemantic(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    room_type: RoomType | None = None


RoomPropType = Literal["bed", "sofa", "table", "armchair", "cupboard", "flower_vase"]
WallPropType = Literal["clock", "painting"]


class HomeProp(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    type: RoomPropType | WallPropType
    placement_type: Literal["room", "wall"]
    room_id: str | None = None
    wall_id: str | None = None
    position: Point
    rotation: float = Field(default=0, ge=0, lt=360)
    wall_offset: float = Field(default=0.5, ge=0, le=1)

    @model_validator(mode="after")
    def validate_placement(self) -> "HomeProp":
        is_wall = self.type in ("clock", "painting")
        if is_wall and (self.placement_type != "wall" or not self.wall_id or self.room_id is not None):
            raise ValueError("wall decor must reference one wall")
        if not is_wall and (self.placement_type != "room" or not self.room_id or self.wall_id is not None):
            raise ValueError("furniture must reference one room")
        return self


class DesignConfiguration(BaseModel):
    wall_height: float = Field(default=3.0, ge=0.5, le=10.0)
    wall_appearances: dict[str, WallAppearance] = Field(default_factory=dict)
    floor_appearances: dict[str, FloorAppearance] = Field(default_factory=dict)
    door_configurations: dict[str, DoorConfiguration] = Field(default_factory=dict)
    window_configurations: dict[str, WindowConfiguration] = Field(default_factory=dict)
    room_semantics: dict[str, RoomSemantic] = Field(default_factory=dict)
    props: list[HomeProp] = Field(default_factory=list, max_length=100)
    orientation: Orientation | None = None

    @field_validator("props")
    @classmethod
    def unique_prop_ids(cls, props: list[HomeProp]) -> list[HomeProp]:
        if len({prop.id for prop in props}) != len(props):
            raise ValueError("prop IDs must be unique")
        return props


class DesignCreate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    configuration: DesignConfiguration | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("design name must not be blank")
        return cleaned


class DesignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    configuration: DesignConfiguration | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        return DesignCreate.clean_name(value)

    @model_validator(mode="after")
    def require_change(self) -> "DesignUpdate":
        if self.name is None and self.configuration is None:
            raise ValueError("name or configuration is required")
        return self


class DesignDuplicate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        return DesignCreate.clean_name(value)


class VastuRule(BaseModel):
    id: str
    title: str
    room_type: RoomType
    preferred_zones: list[Zone]
    description: str
    severity: Literal["info", "advisory"]
    source_reference: str
    enabled: bool = True


class VastuRuleResult(BaseModel):
    rule_id: str
    rule_title: str
    room_id: str | None
    room_name: str | None
    room_type: RoomType
    detected_zone: Zone | None
    preferred_zones: list[Zone]
    result: RuleResultState
    severity: Literal["info", "advisory"]
    explanation: str


class VastuCounts(BaseModel):
    satisfied: int = 0
    unsatisfied: int = 0
    not_applicable: int = 0
    cannot_evaluate: int = 0


class VastuAnalysis(BaseModel):
    design_id: str
    orientation: Orientation | None
    score: float | None
    score_label: str
    counts: VastuCounts
    rule_results: list[VastuRuleResult]
    warnings: list[str]
    analyzed_at: datetime
    analysis_version: str


class VastuAssistRequest(BaseModel):
    structure: StructuralPlan
    configuration: DesignConfiguration


class VastuAssistPreview(BaseModel):
    analysis: VastuAnalysis
    rules: list[VastuRule]


class DesignDetail(BaseModel):
    id: str
    plan_id: str
    name: str
    configuration: DesignConfiguration
    latest_analysis: VastuAnalysis | None = None
    created_at: datetime
    updated_at: datetime
