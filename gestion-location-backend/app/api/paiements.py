from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import can_view_proprietaire, get_current_user, has_permission, managed_proprietaire_ids
from app.database import get_db
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.paiement import Paiement
from app.models.quittance import Quittance
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.paiement import PaiementCreate, PaiementRead, PaiementUpdate

router = APIRouter(prefix="/payments", tags=["payments"])


def _chain_for_paiement(db: Session, echeance_id: int):
    # echeance = db.get(Echeance, echeance_id)
    # bail = db.get(Bail, echeance.bail_id)
    # lot = db.get(Lot, bail.lot_id)
    # bien = db.get(Bien, lot.bien_id)
    echeance = (
    db.query(Echeance)
    .filter(
        Echeance.id == echeance_id,
        Echeance.deleted_at.is_(None)
    )
    .first()
    )

    bail = (
    db.query(Bail)
    .filter(
        Bail.id == echeance.bail_id,
        Bail.deleted_at.is_(None)
    )
    .first()
    )

    lot = (
    db.query(Lot)
    .filter(
        Lot.id == bail.lot_id,
        Lot.deleted_at.is_(None)
    )
    .first()
    )

    bien = (
    db.query(Bien)
    .filter(
        Bien.id == lot.bien_id,
        Bien.deleted_at.is_(None)
    )
    .first()
    )
    return bail, bien


def _can_view_paiement(db: Session, user: Utilisateur, paiement: Paiement) -> bool:
    bail, bien = _chain_for_paiement(db, paiement.echeance_id)
    if user.role == UtilisateurRole.LOCATAIRE and user.id == bail.locataire_id:
        return True
    return bool(bien) and can_view_proprietaire(db, user, bien.proprietaire_id)


@router.get("/", response_model=list[PaiementRead])
def list_paiements(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    # query = db.query(Paiement)
    query = db.query(Paiement).filter(Paiement.deleted_at.is_(None))
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = (
            query.join(Echeance, Echeance.id == Paiement.echeance_id)
            .join(Bail, Bail.id == Echeance.bail_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id == current_user.id)
        )
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = managed_proprietaire_ids(db, current_user.id)
        if not ids:
            return []
        query = (
            query.join(Echeance, Echeance.id == Paiement.echeance_id)
            .join(Bail, Bail.id == Echeance.bail_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id.in_(ids))
        )
    elif current_user.role == UtilisateurRole.LOCATAIRE:
        query = (
            query.join(Echeance, Echeance.id == Paiement.echeance_id)
            .join(Bail, Bail.id == Echeance.bail_id)
            .filter(Bail.locataire_id == current_user.id)
        )
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=PaiementRead, status_code=status.HTTP_201_CREATED)
def create_paiement(
    paiement_in: PaiementCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    bail, bien = _chain_for_paiement(db, paiement_in.echeance_id)
    if not bail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Due date not found")

    is_tenant = current_user.role == UtilisateurRole.LOCATAIRE and current_user.id == bail.locataire_id
    if not is_tenant and not has_permission(db, current_user, bien.proprietaire_id, "CREATE_PAYMENT"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to record this payment")

    paiement = Paiement(**paiement_in.model_dump())
    db.add(paiement)
    db.commit()
    db.refresh(paiement)

    # Une quittance est générée automatiquement pour chaque paiement.
    quittance = Quittance(paiement_id=paiement.id)
    db.add(quittance)
    db.commit()

    return paiement


@router.get("/{paiement_id}", response_model=PaiementRead)
def get_paiement(
    paiement_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    # paiement = db.get(Paiement, paiement_id)
    paiement = (
    db.query(Paiement)
    .filter(
        Paiement.id == paiement_id,
        Paiement.deleted_at.is_(None)
    )
    .first()
    )
    if not paiement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    if not _can_view_paiement(db, current_user, paiement):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this payment")
    return paiement


@router.put("/{paiement_id}", response_model=PaiementRead)
def update_paiement(
    paiement_id: int,
    paiement_in: PaiementUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    # paiement = db.get(Paiement, paiement_id)
    paiement = (
    db.query(Paiement)
    .filter(
        Paiement.id == paiement_id,
        Paiement.deleted_at.is_(None)
    )
    .first()
    )
    if not paiement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    _, bien = _chain_for_paiement(db, paiement.echeance_id)
    if not has_permission(db, current_user, bien.proprietaire_id, "UPDATE_PAYMENT"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this payment")

    for field, value in paiement_in.model_dump(exclude_unset=True).items():
        setattr(paiement, field, value)

    db.commit()
    db.refresh(paiement)
    return paiement
