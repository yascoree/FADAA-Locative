from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.demande_demo import DemandeDemoStatus


class DemandeDemoCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    email: EmailStr
    telephone: str = Field(min_length=1, max_length=30)
    date_souhaitee: Optional[datetime] = None
    message: Optional[str] = None


class DemandeDemoUpdate(BaseModel):
    statut: DemandeDemoStatus


class DemandeDemoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nom: str
    email: str
    telephone: str
    date_souhaitee: Optional[datetime] = None
    message: Optional[str] = None
    statut: DemandeDemoStatus
    date_creation: datetime
