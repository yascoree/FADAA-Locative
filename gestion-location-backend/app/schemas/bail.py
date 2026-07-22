from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.bail import BailStatus
from app.schemas.lot import LotRead
from app.schemas.utilisateur import UtilisateurMini


class BailBase(BaseModel):
    lot_id: int = Field(gt=0)
    locataire_id: int = Field(gt=0)
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    loyer: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    charges: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    depot: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    statut: Optional[BailStatus] = None

    @model_validator(mode="after")
    def check_dates(self):
        if self.date_debut and self.date_fin and self.date_fin < self.date_debut:
            raise ValueError("date_fin must be on or after date_debut")
        return self


class BailCreate(BailBase):
    pass


class BailUpdate(BaseModel):
    date_fin: Optional[date] = None
    loyer: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    charges: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    depot: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    statut: Optional[BailStatus] = None


class BailRead(BailBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    locataire: Optional[UtilisateurMini] = None
    lot: Optional[LotRead] = None