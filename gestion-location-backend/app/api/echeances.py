from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import can_view_proprietaire, get_current_user, has_permission, managed_proprietaire_ids
from app.database import get_db
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.echeance import EcheanceCreate, EcheanceRead, EcheanceUpdate

router = APIRouter(prefix="/due-dates", tags=["due-dates"])


def _bail_and_bien(db: Session, echeance: Echeance):
    # bail = db.get(Bail, echeance.bail_id)
    bail = (
    db.query(Bail)
    .filter(
        Bail.id == echeance.bail_id,
        Bail.deleted_at.is_(None)
    )
    .first()
    )
    # lot = db.get(Lot, bail.lot_id)
    lot = (
    db.query(Lot)
    .filter(
        Lot.id == bail.lot_id,
        Lot.deleted_at.is_(None)
    )
    .first()
    )
    # bien = db.get(Bien, lot.bien_id)
    bien = (
    db.query(Bien)
    .filter(
        Bien.id == lot.bien_id,
        Bien.deleted_at.is_(None)
    )
    .first()
    )
    return bail, bien


def _can_view_echeance(db: Session, user: Utilisateur, echeance: Echeance) -> bool:
    bail, bien = _bail_and_bien(db, echeance)
    if user.role == UtilisateurRole.LOCATAIRE and user.id == bail.locataire_id:
        return True
    return bool(bien) and can_view_proprietaire(db, user, bien.proprietaire_id)


@router.get("/", response_model=list[EcheanceRead])
def list_echeances(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    # query = db.query(Echeance)
    query = db.query(Echeance).filter(Echeance.deleted_at.is_(None))
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


@router.post("/", response_model=EcheanceRead, status_code=status.HTTP_201_CREATED)
def create_echeance(
    echeance_in: EcheanceCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Ajout manuel : la plupart des échéances sont générées automatiquement à la
    création du bail (POST /leases). Utile pour un bail sans date de fin ou un
    échéancier trop long pour être généré d'un coup."""
    # bail = db.get(Bail, echeance_in.bail_id)

    bail = (
    db.query(Bail)
    .filter(
        Bail.id == echeance_in.bail_id,
        Bail.deleted_at.is_(None)
    )
    .first()
    )
    if not bail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lease not found")
    # lot = db.get(Lot, bail.lot_id)

    lot = (
    db.query(Lot)
    .filter(
        Lot.id == bail.lot_id,
        Lot.deleted_at.is_(None)
    )
    .first()
    )
    # bien = db.get(Bien, lot.bien_id)

    bien = (
    db.query(Bien)
    .filter(
        Bien.id == lot.bien_id,
        Bien.deleted_at.is_(None)
    )
    .first()
    )
    if not has_permission(db, current_user, bien.proprietaire_id, "CREATE_DUE_DATE"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to add a due date to this lease")

    echeance = Echeance(**echeance_in.model_dump())
    db.add(echeance)
    db.commit()
    db.refresh(echeance)
    return echeance


@router.get("/{echeance_id}", response_model=EcheanceRead)
def get_echeance(
    echeance_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    # echeance = db.get(Echeance, echeance_id)
    echeance = (
    db.query(Echeance)
    .filter(
        Echeance.id == echeance_id,
        Echeance.deleted_at.is_(None)
    )
    .first()
    )
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
    # echeance = db.get(Echeance, echeance_id)
    echeance = (
    db.query(Echeance)
    .filter(
        Echeance.id == echeance_id,
        Echeance.deleted_at.is_(None)
    )
    .first()
    )
    if not echeance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Due date not found")
    _, bien = _bail_and_bien(db, echeance)
    if not has_permission(db, current_user, bien.proprietaire_id, "UPDATE_DUE_DATE"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this due date")

    for field, value in echeance_in.model_dump(exclude_unset=True).items():
        setattr(echeance, field, value)

    db.commit()
    db.refresh(echeance)
    return echeance
