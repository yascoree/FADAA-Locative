from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import can_manage_proprietaire, get_current_user, managed_proprietaire_ids, require_gestion
from app.database import get_db
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.lot import Lot
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.bail import BailCreate, BailRead, BailUpdate

router = APIRouter(prefix="/leases", tags=["leases"])


def _bien_for_bail(db: Session, bail: Bail) -> Bien:
    lot = db.get(Lot, bail.lot_id)
    return db.get(Bien, lot.bien_id)


def _can_view_bail(db: Session, user: Utilisateur, bail: Bail) -> bool:
    if user.role == UtilisateurRole.LOCATAIRE and user.id == bail.locataire_id:
        return True
    bien = _bien_for_bail(db, bail)
    return bool(bien) and can_manage_proprietaire(db, user, bien.proprietaire_id)


@router.get("/", response_model=list[BailRead])
def list_baux(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Bail)
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = (
            query.join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id == current_user.id)
        )
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = managed_proprietaire_ids(db, current_user.id)
        if not ids:
            return []
        query = (
            query.join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id.in_(ids))
        )
    elif current_user.role == UtilisateurRole.LOCATAIRE:
        query = query.filter(Bail.locataire_id == current_user.id)
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=BailRead, status_code=status.HTTP_201_CREATED)
def create_bail(
    bail_in: BailCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_gestion),
):
    lot = db.get(Lot, bail_in.lot_id)
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lot not found")
    bien = db.get(Bien, lot.bien_id)
    if not can_manage_proprietaire(db, current_user, bien.proprietaire_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to create a lease for this lot")

    bail = Bail(**bail_in.model_dump())
    db.add(bail)
    db.commit()
    db.refresh(bail)
    return bail


@router.get("/{bail_id}", response_model=BailRead)
def get_bail(
    bail_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    bail = db.get(Bail, bail_id)
    if not bail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lease not found")
    if not _can_view_bail(db, current_user, bail):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this lease")
    return bail


@router.put("/{bail_id}", response_model=BailRead)
def update_bail(
    bail_id: int,
    bail_in: BailUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    bail = db.get(Bail, bail_id)
    if not bail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lease not found")
    bien = _bien_for_bail(db, bail)
    if not can_manage_proprietaire(db, current_user, bien.proprietaire_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this lease")

    for field, value in bail_in.model_dump(exclude_unset=True).items():
        setattr(bail, field, value)

    db.commit()
    db.refresh(bail)
    return bail


@router.delete("/{bail_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bail(
    bail_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    bail = db.get(Bail, bail_id)
    if not bail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lease not found")
    bien = _bien_for_bail(db, bail)
    if not can_manage_proprietaire(db, current_user, bien.proprietaire_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this lease")
    db.delete(bail)
    db.commit()
