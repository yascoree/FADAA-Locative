from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

# -1 = illimité pour chacune de ces limites d'usage.
UNLIMITED = -1


class SubscriptionPlanLimits(BaseModel):
    max_biens: int = Field(default=UNLIMITED, ge=-1)
    max_lots: int = Field(default=UNLIMITED, ge=-1)
    max_baux_actifs: int = Field(default=UNLIMITED, ge=-1)
    max_gestionnaires: int = Field(default=UNLIMITED, ge=-1)
    max_locataires: int = Field(default=UNLIMITED, ge=-1)
    max_quittances_mois: int = Field(default=UNLIMITED, ge=-1)


class SubscriptionPlanBase(SubscriptionPlanLimits):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    duration_days: int = Field(gt=0)
    is_trial: bool = False


class SubscriptionPlanCreate(SubscriptionPlanBase):
    pass


class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    duration_days: Optional[int] = Field(default=None, gt=0)
    is_trial: Optional[bool] = None
    max_biens: Optional[int] = Field(default=None, ge=-1)
    max_lots: Optional[int] = Field(default=None, ge=-1)
    max_baux_actifs: Optional[int] = Field(default=None, ge=-1)
    max_gestionnaires: Optional[int] = Field(default=None, ge=-1)
    max_locataires: Optional[int] = Field(default=None, ge=-1)
    max_quittances_mois: Optional[int] = Field(default=None, ge=-1)


class SubscriptionPlanRead(SubscriptionPlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
