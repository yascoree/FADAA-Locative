from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.echeance import EcheanceStatus


class EcheanceBase(BaseModel):
    bail_id: int = Field(gt=0)
    date_echeance: Optional[date] = None
    montant_du: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    statut: Optional[EcheanceStatus] = None


class EcheanceCreate(EcheanceBase):
    pass


class EcheanceUpdate(BaseModel):
    date_echeance: Optional[date] = None
    montant_du: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    statut: Optional[EcheanceStatus] = None


class EcheanceRead(EcheanceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int