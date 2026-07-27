from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.demande_demo import DemandeDemoCreate, DemandeDemoRead, DemandeDemoUpdate
from app.services import demande_demo_service
from app.services.exceptions import NotFound

router = APIRouter(prefix="/demo-requests", tags=["demo-requests"])


@router.post("/", response_model=DemandeDemoRead, status_code=status.HTTP_201_CREATED)
def create_demande_demo(demande_in: DemandeDemoCreate, db: Session = Depends(get_db)):
    """Public : soumis depuis la landing page, aucun compte requis."""
    return demande_demo_service.create_demande_demo(db, demande_in)


@router.get("/", response_model=list[DemandeDemoRead])
def list_demandes_demo(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    return demande_demo_service.list_demandes_demo(db)


@router.put("/{demande_id}", response_model=DemandeDemoRead)
def update_demande_demo_statut(
    demande_id: int,
    demande_in: DemandeDemoUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    try:
        return demande_demo_service.update_demande_demo_statut(db, demande_id, demande_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
