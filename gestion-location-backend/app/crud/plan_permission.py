from sqlalchemy.orm import Session

from app.models.plan_permission import PlanPermission


def get_for_plan(db: Session, plan_id: int) -> list[PlanPermission]:
    return db.query(PlanPermission).filter(PlanPermission.plan_id == plan_id).all()


def replace_for_plan(db: Session, plan_id: int, permissions: list[str]) -> list[PlanPermission]:
    """Remplace intégralement les permissions accordées à un plan."""
    db.query(PlanPermission).filter(PlanPermission.plan_id == plan_id).delete()
    db.add_all([PlanPermission(plan_id=plan_id, permission=code) for code in dict.fromkeys(permissions)])
    db.commit()
    return get_for_plan(db, plan_id)
