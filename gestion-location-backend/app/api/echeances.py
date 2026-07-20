from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import can_manage_proprietaire, get_current_user, managed_proprietaire_ids
from app.database import get_db
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.echeance import EcheanceRead, EcheanceUpdate

router = APIRouter(prefix="/due-dates", tags=["due-dates"])


def _bail_and_bien(db: Session, echeance: Echeance):
    bail = db.get(Bail, echeance.bail_id)
    lot = db.get(Lot, bail.lot_id)
    bien = db.get(Bien, lot.bien_id)
    return bail, bien


def _can_view_echeance(db: Session, user: Utilisateur, echeance: Echeance) -> bool:
    bail, bien = _bail_and_bien(db, echeance)
    if user.role == UtilisateurRole.LOCATAIRE and user.id == bail.locataire_id:
        return True
    return bool(bien) and can_manage_proprietaire(db, user, bien.proprietaire_id)


@router.get("/", response_model=list[EcheanceRead])
def list_echeances(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Echeance)
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = (
            query.join(Bail, Bail.id == Echeance.bail_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id == current_user.id)
        )
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = managed_proprietaire_ids(db, current_user.id)
        if not ids:
            return []
        query = (
            query.join(Bail, Bail.id == Echeance.bail_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id.in_(ids))
        )
    elif current_user.role == UtilisateurRole.LOCATAIRE:
        query = query.join(Bail, Bail.id == Echeance.bail_id).filter(Bail.locataire_id == current_user.id)
    return query.offset(skip).limit(limit).all()


# NOTE: les échéances sont normalement générées automatiquement à la création d'un
# bail ; aucune saisie manuelle n'est exposée pour le moment (POST volontairement absent).


@router.get("/{echeance_id}", response_model=EcheanceRead)
def get_echeance(
    echeance_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    echeance = db.get(Echeance, echeance_id)
    if not echeance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Due date not found")
    if not _can_view_echeance(db, current_user, echeance):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this due date")
    return echeance


@router.put("/{echeance_id}", response_model=EcheanceRead)
def update_echeance(
    echeance_id: int,
    echeance_in: EcheanceUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    echeance = db.get(Echeance, echeance_id)
    if not echeance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Due date not found")
    _, bien = _bail_and_bien(db, echeance)
    if not can_manage_proprietaire(db, current_user, bien.proprietaire_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this due date")

    for field, value in echeance_in.model_dump(exclude_unset=True).items():
        setattr(echeance, field, value)

    db.commit()
    db.refresh(echeance)
    return echeance
