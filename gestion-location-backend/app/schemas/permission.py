from typing import Optional

from pydantic import BaseModel, ConfigDict


class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    libelle: str
    description: Optional[str] = None
