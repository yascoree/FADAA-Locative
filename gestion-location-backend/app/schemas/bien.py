from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.bien import BienStatus
from app.schemas.bien_photo import BienPhotoRead

class BienMini(BaseModel):


    model_config = ConfigDict(from_attributes=True)

    id: int
    designation: Optional[str] = None


class BienBase(BaseModel):
    proprietaire_id: int = Field(gt=0)
    categorie_id: int = Field(gt=0)
    designation: Optional[str] = Field(default=None, max_length=150)
    description: Optional[str] = None
    adresse: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    statut: Optional[BienStatus] = None
    attachement: Optional[str] = Field(default=None, max_length=255)

class BienCreate(BienBase):
    pass

class BienUpdate(BaseModel):
    categorie_id: Optional[int] = Field(default=None, gt=0)
    designation: Optional[str] = Field(default=None, max_length=150)
    description: Optional[str] = None
    adresse: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    statut: Optional[BienStatus] = None
    attachement: Optional[str] = Field(default=None, max_length=255)

class BienRead(BienBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    photos: list[BienPhotoRead] = []
    created_at: datetime

