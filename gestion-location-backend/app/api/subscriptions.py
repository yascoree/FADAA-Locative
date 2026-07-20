from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.crud import subscription as subscription_crud
from app.crud import subscription_plan as subscription_plan_crud
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.subscription import SubscriptionAssign, SubscriptionExtend, SubscriptionRead
from app.services import subscription_service
from app.services.subscription_service import SubscriptionError

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# Gestion des abonnements des propriétaires : réservée à l'admin de la plateforme,
# à l'exception de /subscriptions/me (le propriétaire consulte son propre abonnement).


@router.get("/", response_model=list[SubscriptionRead])
def list_subscriptions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    return subscription_crud.get_multi(db, skip=skip, limit=limit)


@router.get("/me", response_model=SubscriptionRead)
def read_my_subscription(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    subscription = subscription_crud.get_by_owner(db, current_user.id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No subscription for this account")
    return subscription


@router.get("/{subscription_id}", response_model=SubscriptionRead)
def get_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    subscription = subscription_crud.get(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    return subscription


@router.post("/assign", response_model=SubscriptionRead)
def assign_subscription(
    assign_in: SubscriptionAssign,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    """Assigne un plan à un propriétaire, ou change son plan actuel si un
    abonnement existe déjà : même opération dans les deux cas."""
    owner = db.get(Utilisateur, assign_in.owner_id)
    if not owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Owner not found")

    plan = subscription_plan_crud.get(db, assign_in.plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    try:
        return subscription_service.assign_plan(db, assign_in.owner_id, plan)
    except SubscriptionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{subscription_id}/suspend", response_model=SubscriptionRead)
def suspend_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    subscription = subscription_crud.get(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    return subscription_service.suspend(db, subscription)


@router.post("/{subscription_id}/reactivate", response_model=SubscriptionRead)
def reactivate_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    subscription = subscription_crud.get(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    return subscription_service.reactivate(db, subscription)


@router.put("/{subscription_id}/extend", response_model=SubscriptionRead)
def extend_subscription(
    subscription_id: int,
    extend_in: SubscriptionExtend,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    subscription = subscription_crud.get(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    return subscription_service.extend(db, subscription, extend_in.end_date)
