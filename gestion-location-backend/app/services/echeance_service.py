from datetime import datetime

from sqlalchemy.orm import Session

from app.api.deps import bien_ids_with_permission, has_permission_for_bien
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.paiement import Paiement, PaiementStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.echeance import EcheanceCreate, EcheanceUpdate
from app.services.exceptions import BadRequest, Forbidden, NotFound


def _bail_and_bien(db: Session, echeance: Echeance):
    bail = (
        db.query(Bail)
        .filter(Bail.id == echeance.bail_id, Bail.deleted_at.is_(None))
        .first()
    )
    lot = (
        db.query(Lot)
        .filter(Lot.id == bail.lot_id, Lot.deleted_at.is_(None))
        .first()
    )
    bien = (
        db.query(Bien)
        .filter(Bien.id == lot.bien_id, Bien.deleted_at.is_(None))
        .first()
    )
    return bail, bien


def _can_view_echeance(db: Session, user: Utilisateur, echeance: Echeance) -> bool:
    bail, bien = _bail_and_bien(db, echeance)
    if user.role == UtilisateurRole.LOCATAIRE and user.id == bail.locataire_id:
        return True
    return bool(bien) and has_permission_for_bien(db, user, bien, "VIEW_DUE_DATE")


def list_echeances(db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100) -> list[Echeance]:
    query = db.query(Echeance).filter(Echeance.deleted_at.is_(None))
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = (
            query.join(Bail, Bail.id == Echeance.bail_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(
                Bien.proprietaire_id == current_user.id,
                Bail.deleted_at.is_(None),
                Lot.deleted_at.is_(None),
                Bien.deleted_at.is_(None),
            )
        )
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = bien_ids_with_permission(db, current_user.id, "VIEW_DUE_DATE")
        if not ids:
            return []
        query = (
            query.join(Bail, Bail.id == Echeance.bail_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(
                Bien.id.in_(ids),
                Bail.deleted_at.is_(None),
                Lot.deleted_at.is_(None),
                Bien.deleted_at.is_(None),
            )
        )
    elif current_user.role == UtilisateurRole.LOCATAIRE:
        query = query.join(Bail, Bail.id == Echeance.bail_id).filter(Bail.locataire_id == current_user.id)
    return query.offset(skip).limit(limit).all()


def get_echeance(db: Session, current_user: Utilisateur, echeance_id: int) -> Echeance:
    echeance = (
        db.query(Echeance)
        .filter(Echeance.id == echeance_id, Echeance.deleted_at.is_(None))
        .first()
    )
    if not echeance:
        raise NotFound("Due date not found")
    if not _can_view_echeance(db, current_user, echeance):
        raise Forbidden("Not allowed to access this due date")
    return echeance


def create_echeance(db: Session, current_user: Utilisateur, echeance_in: EcheanceCreate) -> Echeance:
    """Manual addition — most due-dates are auto-generated at lease creation."""
    bail = (
        db.query(Bail)
        .filter(Bail.id == echeance_in.bail_id, Bail.deleted_at.is_(None))
        .first()
    )
    if not bail:
        raise NotFound("Lease not found")
    lot = (
        db.query(Lot)
        .filter(Lot.id == bail.lot_id, Lot.deleted_at.is_(None))
        .first()
    )
    bien = (
        db.query(Bien)
        .filter(Bien.id == lot.bien_id, Bien.deleted_at.is_(None))
        .first()
    )
    if not has_permission_for_bien(db, current_user, bien, "CREATE_DUE_DATE"):
        raise Forbidden("Not allowed to add a due date to this lease")
    echeance = Echeance(**echeance_in.model_dump())
    db.add(echeance)
    db.commit()
    db.refresh(echeance)
    return echeance


def update_echeance(db: Session, current_user: Utilisateur, echeance_id: int, echeance_in: EcheanceUpdate) -> Echeance:
    echeance = (
        db.query(Echeance)
        .filter(Echeance.id == echeance_id, Echeance.deleted_at.is_(None))
        .first()
    )
    if not echeance:
        raise NotFound("Due date not found")
    _, bien = _bail_and_bien(db, echeance)
    if not has_permission_for_bien(db, current_user, bien, "UPDATE_DUE_DATE"):
        raise Forbidden("Not allowed to modify this due date")
    for field, value in echeance_in.model_dump(exclude_unset=True).items():
        setattr(echeance, field, value)
    db.commit()
    db.refresh(echeance)
    return echeance


def delete_echeance(db: Session, current_user: Utilisateur, echeance_id: int) -> None:
    echeance = (
        db.query(Echeance)
        .filter(Echeance.id == echeance_id, Echeance.deleted_at.is_(None))
        .first()
    )
    if not echeance:
        raise NotFound("Due date not found")
    _, bien = _bail_and_bien(db, echeance)
    if not has_permission_for_bien(db, current_user, bien, "DELETE_DUE_DATE"):
        raise Forbidden("Not allowed to delete this due date")
    has_valid_paiement = (
        db.query(Paiement)
        .filter(
            Paiement.echeance_id == echeance.id,
            Paiement.deleted_at.is_(None),
            Paiement.statut == PaiementStatus.VALIDE,
        )
        .first()
    )
    if has_valid_paiement:
        raise BadRequest("Impossible de supprimer cette échéance : un paiement y est associé.")
    echeance.deleted_at = datetime.utcnow()
    db.commit()
