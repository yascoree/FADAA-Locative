from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_roles
from app.database import get_db
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.plan_change_request import PlanChangeRequestCreate, PlanChangeRequestRead
from app.services import plan_change_request_service
from app.services.exceptions import BadRequest, NotFound
from app.services.subscription_service import SubscriptionError

router = APIRouter(prefix="/plan-change-requests", tags=["plan-change-requests"])

# Choisir un plan (popup de blocage) est réservé au propriétaire ou gestionnaire admin concerné ;
# consulter/traiter les demandes est réservé à l'admin de la plateforme.
require_plan_requester = require_roles(UtilisateurRole.PROPRIETAIRE, UtilisateurRole.GESTIONNAIRE)


@router.post("/", response_model=PlanChangeRequestRead, status_code=status.HTTP_201_CREATED)
def create_plan_change_request(
    request_in: PlanChangeRequestCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_plan_requester),
):
    try:
        return plan_change_request_service.create_request(db, current_user, request_in)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/me", response_model=Optional[PlanChangeRequestRead])
def get_my_plan_change_request(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_plan_requester),
):
    """La demande EN_ATTENTE du compte connecté, s'il y en a une — pour
    afficher "Choix envoyé, en attente de l'admin" plutôt que le formulaire."""
    return plan_change_request_service.get_my_pending_request(db, current_user)


@router.get("/", response_model=list[PlanChangeRequestRead])
def list_plan_change_requests(
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    return plan_change_request_service.list_requests(db)


@router.post("/{request_id}/approve", response_model=PlanChangeRequestRead)
def approve_plan_change_request(
    request_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    try:
        return plan_change_request_service.approve_request(db, request_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except SubscriptionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{request_id}/reject", response_model=PlanChangeRequestRead)
def reject_plan_change_request(
    request_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    try:
        return plan_change_request_service.reject_request(db, request_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
