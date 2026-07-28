from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.paiement import ModePaiement, PaiementStatus
from app.models.quittance import QuittanceStatus
from app.schemas.echeance import EcheanceRead


class PaiementBase(BaseModel):
    echeance_id: int = Field(gt=0)
    montant: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    mode_paiement: Optional[ModePaiement] = None


class PaiementCreate(PaiementBase):
    pass


class PaiementUpdate(BaseModel):
    montant: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    mode_paiement: Optional[ModePaiement] = None


class QuittanceMini(BaseModel):
    """Version allégée de QuittanceRead, définie ici (pas importée de schemas.quittance)
    pour éviter l'import circulaire paiement <-> quittance."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    statut: QuittanceStatus


class PaiementRead(PaiementBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date_paiement: datetime
    statut: PaiementStatus
    echeance: Optional[EcheanceRead] = None
    quittance: Optional[QuittanceMini] = None