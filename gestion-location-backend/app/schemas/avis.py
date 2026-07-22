from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.avis import AvisStatus


class AvisBase(BaseModel):
    user_id: int | None = Field(default=None, gt=0)
    nom: str = Field(max_length=100)
    prenom: str = Field(max_length=100)
    note: int = Field(ge=1, le=5)
    commentaire: Optional[str] = None



class AvisCreate(AvisBase):
    pass


class AvisUpdate(BaseModel):
    statut: Optional[AvisStatus] = None


class AvisRead(AvisBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date_creation: datetime
    statut: AvisStatus
