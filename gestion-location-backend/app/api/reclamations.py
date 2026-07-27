from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_roles
from app.database import get_db
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.reclamation import ReclamationCreate, ReclamationRead, ReclamationUpdate
from app.services import reclamation_service
from app.services.exceptions import BadRequest, NotFound

router = APIRouter(prefix="/reclamations", tags=["reclamations"])

require_proprietaire = require_roles(UtilisateurRole.PROPRIETAIRE)


@router.get("/", response_model=list[ReclamationRead])
def list_reclamations(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return reclamation_service.list_reclamations(db, current_user)


@router.post("/", response_model=ReclamationRead, status_code=status.HTTP_201_CREATED)
def create_reclamation(
    reclamation_in: ReclamationCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_proprietaire),
):
    return reclamation_service.create_reclamation(db, current_user, reclamation_in)


@router.put("/{reclamation_id}", response_model=ReclamationRead)
def update_reclamation_statut(
    reclamation_id: int,
    reclamation_in: ReclamationUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    try:
        return reclamation_service.update_reclamation_statut(db, current_user, reclamation_id, reclamation_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
