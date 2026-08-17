from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_gestion, require_roles
from app.database import get_db
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.demande_maintenance import (
    DemandeMaintenanceCreate,
    DemandeMaintenanceRead,
    DemandeMaintenanceUpdate,
)
from app.services import maintenance_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

router = APIRouter(prefix="/maintenance-requests", tags=["maintenance-requests"])

require_locataire = require_roles(UtilisateurRole.LOCATAIRE)


@router.get("/", response_model=list[DemandeMaintenanceRead])
def list_demandes(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return maintenance_service.list_demandes(db, current_user)


@router.post("/", response_model=DemandeMaintenanceRead, status_code=status.HTTP_201_CREATED)
def create_demande(
    demande_in: DemandeMaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_locataire),
):
    try:
        return maintenance_service.create_demande(db, current_user, demande_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get("/{demande_id}", response_model=DemandeMaintenanceRead)
def get_demande(
    demande_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return maintenance_service.get_demande(db, current_user, demande_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.put("/{demande_id}", response_model=DemandeMaintenanceRead)
def update_demande(
    demande_id: int,
    demande_in: DemandeMaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_gestion),
):
    try:
        return maintenance_service.update_demande(db, current_user, demande_id, demande_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
