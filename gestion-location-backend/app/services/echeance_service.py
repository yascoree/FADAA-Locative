from datetime import datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import bien_ids_with_permission, can_access_proprietaire, has_permission_for_bien
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance, EcheanceStatus
from app.models.lot import Lot
from app.models.paiement import Paiement, PaiementStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.echeance import EcheanceCreate, EcheanceUpdate
from app.services.exceptions import BadRequest, Forbidden, NotFound


def sync_echeance_statut(db: Session, echeance: Echeance) -> None:
    """Recomputes Echeance.statut from the sum of its validated paiements —
    the only source of truth for this field, it is never set by hand.
    Call after creating/cancelling/deleting a paiement on this échéance."""
    total_paid = (
        db.query(func.coalesce(func.sum(Paiement.montant), 0))
        .filter(
            Paiement.echeance_id == echeance.id,
            Paiement.deleted_at.is_(None),
            Paiement.statut == PaiementStatus.VALIDE,
        )
        .scalar()
    ) or Decimal("0")
    montant_du = echeance.montant_du or Decimal("0")

    if total_paid <= 0:
        new_statut = EcheanceStatus.IMPAYE
    elif total_paid < montant_du:
        new_statut = EcheanceStatus.PARTIEL
    else:
        new_statut = EcheanceStatus.PAYE

    if echeance.statut != new_statut:
        echeance.statut = new_statut
        db.commit()


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


def list_echeances(
    db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100, proprietaire_id: int | None = None
) -> list[Echeance]:
    if proprietaire_id is not None and not can_access_proprietaire(db, current_user, proprietaire_id):
        raise Forbidden("Not allowed to access this proprietaire")
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
    if proprietaire_id is not None:
        if current_user.role == UtilisateurRole.LOCATAIRE:
            query = query.join(Lot, Lot.id == Bail.lot_id).join(Bien, Bien.id == Lot.bien_id)
        query = query.filter(Bien.proprietaire_id == proprietaire_id, Bail.deleted_at.is_(None), Lot.deleted_at.is_(None), Bien.deleted_at.is_(None))
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
    if echeance_in.date_echeance is not None:
        duplicate = (
            db.query(Echeance)
            .filter(
                Echeance.bail_id == echeance_in.bail_id,
                Echeance.date_echeance == echeance_in.date_echeance,
                Echeance.deleted_at.is_(None),
            )
            .first()
        )
        if duplicate:
            raise BadRequest("Une échéance existe déjà pour ce bail à cette date.")
    # statut is never client-supplied — a brand-new échéance has no paiement yet.
    echeance = Echeance(**echeance_in.model_dump(), statut=EcheanceStatus.IMPAYE)
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
    # Once a paiement (partiel ou total) est rattaché, la date et le montant sont
    # figés — les modifier romprait la cohérence avec les paiements/quittances déjà émis.
    if echeance.statut in (EcheanceStatus.PAYE, EcheanceStatus.PARTIEL):
        raise BadRequest("Impossible de modifier cette échéance : un paiement y est déjà associé.")
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
    # Bloqué dès qu'un paiement existe (validé ou annulé) : un paiement annulé reste
    # une pièce d'historique qui référence cette échéance, elle ne doit pas devenir
    # orpheline. Couvre aussi bien les paiements partiels que les paiements complets.
    has_paiement = (
        db.query(Paiement)
        .filter(Paiement.echeance_id == echeance.id, Paiement.deleted_at.is_(None))
        .first()
    )
    if has_paiement:
        raise BadRequest("Impossible de supprimer cette échéance : un paiement y est associé.")
    echeance.deleted_at = datetime.utcnow()
    db.commit()
