from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.partenaire import PartenaireStatus


class PartenaireBase(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    logo: Optional[str] = Field(default=None, max_length=255)
    site_web: Optional[str] = Field(default=None, max_length=255)
    email: Optional[EmailStr] = Field(default=None, max_length=255)
    telephone: Optional[str] = Field(default=None, max_length=30)
    adresse: Optional[str] = None
    statut: PartenaireStatus = PartenaireStatus.ACTIF


class PartenaireCreate(PartenaireBase):
    pass


class PartenaireUpdate(BaseModel):
    nom: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    logo: Optional[str] = Field(default=None, max_length=255)
    site_web: Optional[str] = Field(default=None, max_length=255)
    email: Optional[EmailStr] = Field(default=None, max_length=255)
    telephone: Optional[str] = Field(default=None, max_length=30)
    adresse: Optional[str] = None
    statut: Optional[PartenaireStatus] = None


class PartenaireRead(PartenaireBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date_creation: datetime
