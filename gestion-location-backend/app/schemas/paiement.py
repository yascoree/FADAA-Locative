from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.paiement import ModePaiement


class PaiementBase(BaseModel):
    echeance_id: int = Field(gt=0)
    montant: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    mode_paiement: Optional[ModePaiement] = None


class PaiementCreate(PaiementBase):
    pass


class PaiementUpdate(BaseModel):
    montant: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    mode_paiement: Optional[ModePaiement] = None


class PaiementRead(PaiementBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date_paiement: datetime