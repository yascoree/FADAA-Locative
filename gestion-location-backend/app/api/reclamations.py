from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_roles
from app.database import get_db
from app.models.reclamation import Reclamation, ReclamationStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.reclamation import ReclamationCreate, ReclamationRead, ReclamationUpdate

router = APIRouter(prefix="/reclamations", tags=["reclamations"])

require_proprietaire = require_roles(UtilisateurRole.PROPRIETAIRE)


@router.get("/", response_model=list[ReclamationRead])
def list_reclamations(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Reclamation)
    if current_user.role != UtilisateurRole.ADMINISTRATEUR:
        query = query.filter(Reclamation.proprietaire_id == current_user.id)
    return query.order_by(Reclamation.date_creation.desc()).all()


@router.post("/", response_model=ReclamationRead, status_code=status.HTTP_201_CREATED)
def create_reclamation(
    reclamation_in: ReclamationCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_proprietaire),
):
    reclamation = Reclamation(
        proprietaire_id=current_user.id,
        sujet=reclamation_in.sujet,
        message=reclamation_in.message,
    )
    db.add(reclamation)
    db.commit()
    db.refresh(reclamation)
    return reclamation


@router.put("/{reclamation_id}", response_model=ReclamationRead)
def update_reclamation_statut(
    reclamation_id: int,
    reclamation_in: ReclamationUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    reclamation = db.get(Reclamation, reclamation_id)
    if not reclamation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reclamation not found")
    if reclamation.statut != ReclamationStatus.EN_ATTENTE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reclamation already processed")

    reclamation.statut = reclamation_in.statut
    reclamation.date_traitement = datetime.utcnow()
    reclamation.traite_par_id = current_user.id
    db.commit()
    db.refresh(reclamation)
    return reclamation
