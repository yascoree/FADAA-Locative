from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime


from app.api.deps import get_current_user, require_admin, require_gestion
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurRead, UtilisateurUpdate
from app.services import utilisateur_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UtilisateurRead])
def list_utilisateurs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    return utilisateur_service.list_utilisateurs(db, skip, limit)


@router.post("/", response_model=UtilisateurRead, status_code=status.HTTP_201_CREATED)
def create_utilisateur(
    utilisateur_in: UtilisateurCreate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    """Reserved for admins: direct account creation with a given role.
    Public registration goes through /auth/register (always Propriétaire)."""
    try:
        return utilisateur_service.create_utilisateur(db, utilisateur_in)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/lookup", response_model=UtilisateurRead)
def lookup_utilisateur_by_email(
    email: str,
    role: str = "GESTIONNAIRE",
    db: Session = Depends(get_db),
    _current_user: Utilisateur = Depends(require_gestion),
):
    """Search for a GESTIONNAIRE or LOCATAIRE by e-mail so that a
    proprietaire/gestionnaire can invite a manager via a Mandat or look up a
    tenant id without access to the full user directory (admin-only). Must be
    declared before /{utilisateur_id} to avoid being caught by that route."""
    try:
        return utilisateur_service.lookup_utilisateur_by_email(db, email, role)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get("/{utilisateur_id}", response_model=UtilisateurRead)
def get_utilisateur(
    utilisateur_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return utilisateur_service.get_utilisateur(db, current_user, utilisateur_id)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{utilisateur_id}", response_model=UtilisateurRead)
def update_utilisateur(
    utilisateur_id: int,
    utilisateur_in: UtilisateurUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return utilisateur_service.update_utilisateur(db, current_user, utilisateur_id, utilisateur_in)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete("/{utilisateur_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_utilisateur(
    utilisateur_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    try:
        utilisateur_service.delete_utilisateur(db, utilisateur_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{utilisateur_id}/activate", response_model=UtilisateurRead)
def activate_utilisateur(
    utilisateur_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    try:
        return utilisateur_service.activate_utilisateur(db, utilisateur_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{utilisateur_id}/deactivate", response_model=UtilisateurRead)
def deactivate_utilisateur(
    utilisateur_id: int,
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(require_admin),
):
    try:
        return utilisateur_service.deactivate_utilisateur(db, admin, utilisateur_id)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
