from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.api.deps import get_current_user, require_roles
from app.database import get_db
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.manager_permission import ManagerPermissionRead, ManagerPermissionsUpdate
from app.schemas.mandat import MandatCreate, MandatRead, MandatUpdate
from app.services import mandat_service
from app.services.exceptions import BadRequest, Forbidden, NotFound, PaymentRequired

router = APIRouter(prefix="/mandates", tags=["mandates"])

# A mandate is the trust link that gives a gestionnaire access to a proprietaire's
# properties: only the proprietaire concerned (or an admin) can create one,
# to prevent a gestionnaire from self-granting access to someone else's properties.
require_mandat_creator = require_roles(UtilisateurRole.ADMINISTRATEUR, UtilisateurRole.PROPRIETAIRE)


@router.get("/", response_model=list[MandatRead])
def list_mandats(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return mandat_service.list_mandats(db, current_user, skip, limit)


@router.post("/", response_model=MandatRead, status_code=status.HTTP_201_CREATED)
def create_mandat(
    mandat_in: MandatCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_mandat_creator),
):
    try:
        return mandat_service.create_mandat(db, current_user, mandat_in)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except PaymentRequired as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))


@router.get("/{mandat_id}", response_model=MandatRead)
def get_mandat(
    mandat_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return mandat_service.get_mandat(db, current_user, mandat_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.put("/{mandat_id}", response_model=MandatRead)
def update_mandat(
    mandat_id: int,
    mandat_in: MandatUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return mandat_service.update_mandat(db, current_user, mandat_id, mandat_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except PaymentRequired as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))


@router.delete("/{mandat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mandat(
    mandat_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        mandat_service.delete_mandat(db, current_user, mandat_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get("/{mandat_id}/permissions", response_model=list[ManagerPermissionRead])
def list_mandat_permissions(
    mandat_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return mandat_service.list_mandat_permissions(db, current_user, mandat_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.put("/{mandat_id}/permissions", response_model=list[ManagerPermissionRead])
def set_mandat_permissions(
    mandat_id: int,
    permissions_in: ManagerPermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Fully replaces permissions granted on this mandate. Reserved for the
    proprietaire concerned (or an admin): a gestionnaire can never grant
    themselves permissions."""
    try:
        return mandat_service.set_mandat_permissions(db, current_user, mandat_id, permissions_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
