from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_gestion
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurRead, UtilisateurUpdate
from app.services import locataire_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/", response_model=list[UtilisateurRead])
def list_locataires(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return locataire_service.list_locataires(db, current_user, skip, limit)


@router.post("/", response_model=UtilisateurRead, status_code=status.HTTP_201_CREATED)
def create_locataire(
    locataire_in: UtilisateurCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_gestion),
):
    """Allows a proprietaire/gestionnaire to onboard a tenant without going through an admin."""
    try:
        return locataire_service.create_locataire(db, current_user, locataire_in)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{locataire_id}", response_model=UtilisateurRead)
def get_locataire(
    locataire_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return locataire_service.get_locataire(db, current_user, locataire_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.put("/{locataire_id}", response_model=UtilisateurRead)
def update_locataire(
    locataire_id: int,
    locataire_in: UtilisateurUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return locataire_service.update_locataire(db, current_user, locataire_id, locataire_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
