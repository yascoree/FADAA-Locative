from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import can_view_proprietaire, get_current_user, has_permission, managed_proprietaire_ids, require_gestion
from app.database import get_db
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.lot import Lot
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.lot import LotCreate, LotRead, LotUpdate

router = APIRouter(prefix="/lots", tags=["lots"])


def _is_tenant_of_lot(db: Session, user_id: int, lot_id: int) -> bool:
    return db.query(Bail).filter(Bail.lot_id == lot_id, Bail.locataire_id == user_id).first() is not None


def _can_view_lot(db: Session, user: Utilisateur, lot: Lot) -> bool:
    bien = db.get(Bien, lot.bien_id)
    if bien and can_view_proprietaire(db, user, bien.proprietaire_id):
        return True
    return user.role == UtilisateurRole.LOCATAIRE and _is_tenant_of_lot(db, user.id, lot.id)


@router.get("/", response_model=list[LotRead])
def list_lots(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Lot)
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = query.join(Bien, Bien.id == Lot.bien_id).filter(Bien.proprietaire_id == current_user.id)
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = managed_proprietaire_ids(db, current_user.id)
        if not ids:
            return []
        query = query.join(Bien, Bien.id == Lot.bien_id).filter(Bien.proprietaire_id.in_(ids))
    elif current_user.role == UtilisateurRole.LOCATAIRE:
        query = query.join(Bail, Bail.lot_id == Lot.id).filter(Bail.locataire_id == current_user.id).distinct()
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=LotRead, status_code=status.HTTP_201_CREATED)
def create_lot(
    lot_in: LotCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_gestion),
):
    bien = db.get(Bien, lot_in.bien_id)
    if not bien:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if not has_permission(db, current_user, bien.proprietaire_id, "CREATE_LOT"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to add a lot to this property")

    lot = Lot(**lot_in.model_dump())
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot


@router.get("/{lot_id}", response_model=LotRead)
def get_lot(
    lot_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    lot = db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lot not found")
    if not _can_view_lot(db, current_user, lot):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this lot")
    return lot


@router.put("/{lot_id}", response_model=LotRead)
def update_lot(
    lot_id: int,
    lot_in: LotUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    lot = db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lot not found")
    bien = db.get(Bien, lot.bien_id)
    if not has_permission(db, current_user, bien.proprietaire_id, "UPDATE_LOT"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this lot")

    for field, value in lot_in.model_dump(exclude_unset=True).items():
        setattr(lot, field, value)

    db.commit()
    db.refresh(lot)
    return lot


@router.delete("/{lot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lot(
    lot_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    lot = db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lot not found")
    bien = db.get(Bien, lot.bien_id)
    if not has_permission(db, current_user, bien.proprietaire_id, "DELETE_LOT"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this lot")
    db.delete(lot)
    db.commit()
