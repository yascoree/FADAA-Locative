from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.bien import Bien
from app.models.charge import Charge
from app.models.lot import Lot
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.charge import ChargeCreate, ChargeUpdate
from app.services.exceptions import BadRequest, Forbidden, NotFound


def _resolve_bien(db: Session, bien_id: Optional[int], lot_id: Optional[int]) -> Bien:
    """A charge is linked to exactly one of bien_id/lot_id — never both, never
    neither — so the revenue deduction in stats_service always has a single
    unambiguous bien to attribute it to."""
    if bool(bien_id) == bool(lot_id):
        raise BadRequest("Une charge doit être liée à un bien OU à un lot, pas les deux.")
    if lot_id:
        lot = db.query(Lot).filter(Lot.id == lot_id, Lot.deleted_at.is_(None)).first()
        if not lot:
            raise NotFound("Lot not found")
        bien = db.query(Bien).filter(Bien.id == lot.bien_id, Bien.deleted_at.is_(None)).first()
    else:
        bien = db.query(Bien).filter(Bien.id == bien_id, Bien.deleted_at.is_(None)).first()
    if not bien:
        raise NotFound("Bien not found")
    return bien


def _can_manage(current_user: Utilisateur, bien: Bien) -> bool:
    if current_user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    return current_user.role == UtilisateurRole.PROPRIETAIRE and current_user.id == bien.proprietaire_id


def list_charges(
    db: Session, current_user: Utilisateur, bien_id: Optional[int] = None, lot_id: Optional[int] = None
) -> list[Charge]:
    query = db.query(Charge).filter(Charge.deleted_at.is_(None))
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        owned_bien_ids = {row[0] for row in db.query(Bien.id).filter(Bien.proprietaire_id == current_user.id).all()}
        owned_lot_ids = {row[0] for row in db.query(Lot.id).join(Bien, Bien.id == Lot.bien_id).filter(Bien.proprietaire_id == current_user.id).all()}
        query = query.filter(
            ((Charge.bien_id.isnot(None)) & (Charge.bien_id.in_(owned_bien_ids)))
            | ((Charge.lot_id.isnot(None)) & (Charge.lot_id.in_(owned_lot_ids)))
        )
    elif current_user.role != UtilisateurRole.ADMINISTRATEUR:
        return []
    if bien_id:
        query = query.filter(Charge.bien_id == bien_id)
    if lot_id:
        query = query.filter(Charge.lot_id == lot_id)
    return query.order_by(Charge.date_charge.desc()).all()


def create_charge(db: Session, current_user: Utilisateur, charge_in: ChargeCreate) -> Charge:
    bien = _resolve_bien(db, charge_in.bien_id, charge_in.lot_id)
    if not _can_manage(current_user, bien):
        raise Forbidden("Not allowed to add a charge for this property")
    charge = Charge(**charge_in.model_dump(), cree_par_id=current_user.id)
    db.add(charge)
    db.commit()
    db.refresh(charge)
    return charge


def update_charge(db: Session, current_user: Utilisateur, charge_id: int, charge_in: ChargeUpdate) -> Charge:
    charge = db.query(Charge).filter(Charge.id == charge_id, Charge.deleted_at.is_(None)).first()
    if not charge:
        raise NotFound("Charge not found")
    bien = _resolve_bien(db, charge.bien_id, charge.lot_id)
    if not _can_manage(current_user, bien):
        raise Forbidden("Not allowed to modify this charge")
    for field, value in charge_in.model_dump(exclude_unset=True).items():
        setattr(charge, field, value)
    db.commit()
    db.refresh(charge)
    return charge


def delete_charge(db: Session, current_user: Utilisateur, charge_id: int) -> None:
    charge = db.query(Charge).filter(Charge.id == charge_id, Charge.deleted_at.is_(None)).first()
    if not charge:
        raise NotFound("Charge not found")
    bien = _resolve_bien(db, charge.bien_id, charge.lot_id)
    if not _can_manage(current_user, bien):
        raise Forbidden("Not allowed to delete this charge")
    charge.deleted_at = datetime.utcnow()
    db.commit()
