from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PlanPermissionsUpdate(BaseModel):
    """Remplace intégralement l'ensemble des permissions accordées par un plan."""

    permissions: list[str] = Field(default_factory=list)


class PlanPermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    plan_id: int
    permission: str
    created_at: datetime
