from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.bien import BienStatus
from app.schemas.bien_photo import BienPhotoRead


class BienBase(BaseModel):
    proprietaire_id: int = Field(gt=0)
    categorie_id: int = Field(gt=0)
    designation: Optional[str] = Field(default=None, max_length=150)
    statut: Optional[BienStatus] = None
    attachement: Optional[str] = Field(default=None, max_length=255)


class BienCreate(BienBase):
    pass


class BienUpdate(BaseModel):
    categorie_id: Optional[int] = Field(default=None, gt=0)
    designation: Optional[str] = Field(default=None, max_length=150)
    statut: Optional[BienStatus] = None
    attachement: Optional[str] = Field(default=None, max_length=255)


class BienRead(BienBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    photos: list[BienPhotoRead] = []