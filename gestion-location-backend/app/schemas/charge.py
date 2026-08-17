from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ChargeBase(BaseModel):
    bien_id: Optional[int] = Field(default=None, gt=0)
    lot_id: Optional[int] = Field(default=None, gt=0)
    libelle: str = Field(max_length=150)
    montant: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    date_charge: date
    description: Optional[str] = None


class ChargeCreate(ChargeBase):
    pass


class ChargeUpdate(BaseModel):
    libelle: Optional[str] = Field(default=None, max_length=150)
    montant: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    date_charge: Optional[date] = None
    description: Optional[str] = None


class ChargeRead(ChargeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cree_par_id: int
    created_at: datetime
