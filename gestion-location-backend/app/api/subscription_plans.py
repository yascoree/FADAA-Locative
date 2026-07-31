from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.crud import plan_permission as plan_permission_crud
from app.crud import subscription_plan as subscription_plan_crud
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.plan_permission import PlanPermissionRead, PlanPermissionsUpdate
from app.schemas.subscription_plan import SubscriptionPlanCreate, SubscriptionPlanRead, SubscriptionPlanUpdate

router = APIRouter(prefix="/subscription-plans", tags=["subscription-plans"])

# Gestion des plans d'abonnement : réservée à l'admin de la plateforme (voir
# app.services.subscription_service pour la logique d'attribution aux propriétaires).


@router.get("/", response_model=list[SubscriptionPlanRead])
def list_subscription_plans(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    return subscription_plan_crud.get_multi(db, skip=skip, limit=limit)


@router.post("/", response_model=SubscriptionPlanRead, status_code=status.HTTP_201_CREATED)
def create_subscription_plan(
    plan_in: SubscriptionPlanCreate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    if subscription_plan_crud.get_by_name(db, plan_in.name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A plan with this name already exists")
    return subscription_plan_crud.create(db, plan_in)


@router.get("/{plan_id}", response_model=SubscriptionPlanRead)
def get_subscription_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    plan = subscription_plan_crud.get(db, plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


@router.put("/{plan_id}", response_model=SubscriptionPlanRead)
def update_subscription_plan(
    plan_id: int,
    plan_in: SubscriptionPlanUpdate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    plan = subscription_plan_crud.get(db, plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return subscription_plan_crud.update(db, plan, plan_in)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subscription_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    plan = subscription_plan_crud.get(db, plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    if subscription_plan_crud.count_subscriptions(db, plan_id) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plan is used by existing subscriptions",
        )
    subscription_plan_crud.remove(db, plan)


@router.post("/{plan_id}/activate", response_model=SubscriptionPlanRead)
def activate_subscription_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    plan = subscription_plan_crud.get(db, plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return subscription_plan_crud.set_active(db, plan, True)


@router.post("/{plan_id}/deactivate", response_model=SubscriptionPlanRead)
def deactivate_subscription_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    plan = subscription_plan_crud.get(db, plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return subscription_plan_crud.set_active(db, plan, False)


@router.get("/{plan_id}/permissions", response_model=list[PlanPermissionRead])
def list_plan_permissions(
    plan_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    if not subscription_plan_crud.get(db, plan_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan_permission_crud.get_for_plan(db, plan_id)


@router.put("/{plan_id}/permissions", response_model=list[PlanPermissionRead])
def set_plan_permissions(
    plan_id: int,
    permissions_in: PlanPermissionsUpdate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    if not subscription_plan_crud.get(db, plan_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan_permission_crud.replace_for_plan(db, plan_id, permissions_in.permissions)
