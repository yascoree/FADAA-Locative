from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.lot import LotStatus


class LotBase(BaseModel):
    bien_id: int = Field(gt=0)
    reference: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = None
    loyer_reference: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    statut: Optional[LotStatus] = None
    attachement: Optional[str] = Field(default=None, max_length=255)


class LotCreate(LotBase):
    pass


class LotUpdate(BaseModel):
    reference: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = None
    loyer_reference: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    statut: Optional[LotStatus] = None
    attachement: Optional[str] = Field(default=None, max_length=255)


class LotRead(LotBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
