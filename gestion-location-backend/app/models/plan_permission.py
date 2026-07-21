from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class PlanPermission(Base):
    """Feature/permission code unlocked by a SubscriptionPlan. Independent from
    app.models.permission.Permission / ManagerPermission (Phase 1, owner -> gestionnaire
    delegation) : this is a separate layer describing what a subscription tier unlocks,
    not who a proprietaire delegates to."""

    __tablename__ = "plan_permissions"
    __table_args__ = (UniqueConstraint("plan_id", "permission", name="uq_plan_permission"),)

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id", ondelete="CASCADE"), nullable=False)
    permission = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    plan = relationship("SubscriptionPlan", back_populates="permissions")
