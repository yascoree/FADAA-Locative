from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.subscription import SubscriptionStatus
from app.schemas.subscription_plan import SubscriptionPlanRead


class SubscriptionAssign(BaseModel):
    """Assigne (ou change) le plan d'un propriétaire. Crée la souscription si elle
    n'existe pas encore, la met à jour sinon."""

    owner_id: int = Field(gt=0)
    plan_id: int = Field(gt=0)


class SubscriptionExtend(BaseModel):
    end_date: datetime


class SubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    plan_id: int
    plan: SubscriptionPlanRead
    status: SubscriptionStatus
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
