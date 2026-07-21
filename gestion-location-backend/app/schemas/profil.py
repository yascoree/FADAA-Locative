from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProfilBase(BaseModel):
    telephone: Optional[str] = Field(default=None, max_length=20)
    adresse: Optional[str] = None
    photo: Optional[str] = Field(default=None, max_length=255)
    date_naissance: Optional[date] = None
    piece_identite: Optional[str] = Field(default=None, max_length=255)


class ProfilCreate(ProfilBase):
    utilisateur_id: int = Field(gt=0)


class ProfilUpdate(BaseModel):
    telephone: Optional[str] = Field(default=None, max_length=20)
    adresse: Optional[str] = None
    photo: Optional[str] = Field(default=None, max_length=255)
    date_naissance: Optional[date] = None
    piece_identite: Optional[str] = Field(default=None, max_length=255)


class ProfilRead(ProfilBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    utilisateur_id: int