from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.plan_change_request import PlanChangeRequestStatus
from app.schemas.subscription_plan import SubscriptionPlanRead
from app.schemas.utilisateur import UtilisateurMini


class PlanChangeRequestCreate(BaseModel):
    plan_id: int = Field(gt=0)
    message: Optional[str] = Field(default=None, max_length=500)


class PlanChangeRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    plan_id: int
    plan: SubscriptionPlanRead
    owner: UtilisateurMini
    message: Optional[str] = None
    statut: PlanChangeRequestStatus
    date_creation: datetime
