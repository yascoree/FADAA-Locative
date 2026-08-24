from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.subscription import SubscriptionStatus
from app.schemas.subscription_plan import SubscriptionPlanRead


class SubscriptionAssign(BaseModel):
    """Assigne (ou change) le plan d'une entité. Crée la souscription si elle
    n'existe pas encore, la met à jour sinon."""

    owner_id: Optional[int] = Field(default=None, gt=0)
    agence_id: Optional[int] = Field(default=None, gt=0)
    plan_id: int = Field(gt=0)


class SubscriptionExtend(BaseModel):
    end_date: datetime


class SubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: Optional[int] = None
    agence_id: Optional[int] = None
    owner_name: Optional[str] = None
    agence_name: Optional[str] = None
    plan_id: int
    plan: SubscriptionPlanRead
    status: SubscriptionStatus
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SubscriptionUsageRead(BaseModel):
    biens: int
    lots: int
    baux_actifs: int
    gestionnaires: int # Pour les propriétaires
    locataires: int
    quittances_mois: int
    membres_agence: int = 0
    storage_mb: int = 0
