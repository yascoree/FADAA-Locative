from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.echeance import EcheanceStatus
from app.schemas.bail import BailRead


class EcheanceBase(BaseModel):
    bail_id: int = Field(gt=0)
    date_echeance: Optional[date] = None
    montant_du: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)


class EcheanceCreate(EcheanceBase):
    pass


class EcheanceUpdate(BaseModel):
    date_echeance: Optional[date] = None
    montant_du: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)


class EcheanceRead(EcheanceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    statut: Optional[EcheanceStatus] = None
    bail: Optional[BailRead] = None

    @computed_field
    @property
    def reference(self) -> str:
        """Identifiant lisible et unique par construction (dérivé de l'id) —
        affiché et recherchable côté frontend, ex. ECH-000123."""
        return f"ECH-{self.id:06d}"