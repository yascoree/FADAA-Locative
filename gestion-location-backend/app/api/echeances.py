from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.echeance import EcheanceCreate, EcheanceRead, EcheanceUpdate
from app.services import echeance_service, reminder_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

router = APIRouter(prefix="/due-dates", tags=["due-dates"])


@router.get("/", response_model=list[EcheanceRead])
def list_echeances(
    skip: int = 0,
    limit: int = 100,
    proprietaire_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return echeance_service.list_echeances(db, current_user, skip, limit, proprietaire_id=proprietaire_id)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/", response_model=EcheanceRead, status_code=status.HTTP_201_CREATED)
def create_echeance(
    echeance_in: EcheanceCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Manual addition — most due-dates are auto-generated at lease creation (POST /leases).
    Useful for open-ended leases or schedules too long to generate in one batch."""
    try:
        return echeance_service.create_echeance(db, current_user, echeance_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get("/{echeance_id}", response_model=EcheanceRead)
def get_echeance(
    echeance_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return echeance_service.get_echeance(db, current_user, echeance_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.put("/{echeance_id}", response_model=EcheanceRead)
def update_echeance(
    echeance_id: int,
    echeance_in: EcheanceUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return echeance_service.update_echeance(db, current_user, echeance_id, echeance_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{echeance_id}/relance", status_code=status.HTTP_200_OK)
def relance_echeance(
    echeance_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Relance manuelle : propriétaire ou gestionnaire mandaté peut renvoyer
    immédiatement une notification de retard pour une échéance en retard,
    sans attendre le prochain passage du cron quotidien."""
    try:
        reminder_service.send_manual_relance(db, current_user, echeance_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {"detail": "Relance envoyée."}


@router.delete("/{echeance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_echeance(
    echeance_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        echeance_service.delete_echeance(db, current_user, echeance_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
