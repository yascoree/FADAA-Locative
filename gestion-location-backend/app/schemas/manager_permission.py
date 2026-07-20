from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.permission import PermissionRead


class ManagerPermissionsUpdate(BaseModel):
    """Remplace intégralement l'ensemble des permissions accordées pour un mandat."""

    permissions: list[str] = Field(default_factory=list)


class ManagerPermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mandat_id: int
    permission: PermissionRead
    date_attribution: datetime
