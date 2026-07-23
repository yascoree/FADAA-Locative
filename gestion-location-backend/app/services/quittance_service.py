from pathlib import Path

from sqlalchemy.orm import Session

from app.api.deps import bien_ids_with_permission, has_permission_for_bien
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.paiement import Paiement
from app.models.quittance import Quittance
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.services.exceptions import Forbidden, NotFound
from app.services.receipt_service import generate_receipt_pdf


def _bail_and_bien(db: Session, quittance: Quittance):
    paiement = (
        db.query(Paiement)
        .filter(Paiement.id == quittance.paiement_id, Paiement.deleted_at.is_(None))
        .first()
    )
    echeance = (
        db.query(Echeance)
        .filter(Echeance.id == paiement.echeance_id, Echeance.deleted_at.is_(None))
        .first()
    )
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


def _can_view_quittance(db: Session, user: Utilisateur, quittance: Quittance) -> bool:
    bail, bien = _bail_and_bien(db, quittance)
    if user.role == UtilisateurRole.LOCATAIRE and user.id == bail.locataire_id:
        return True
    return bool(bien) and has_permission_for_bien(db, user, bien, "VIEW_PAYMENT")


def list_quittances(db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100) -> list[Quittance]:
    query = db.query(Quittance).filter(Quittance.deleted_at.is_(None))
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = (
            query.join(Paiement, Paiement.id == Quittance.paiement_id)
            .join(Echeance, Echeance.id == Paiement.echeance_id)
            .join(Bail, Bail.id == Echeance.bail_id)
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
        ids = bien_ids_with_permission(db, current_user.id, "VIEW_PAYMENT")
        if not ids:
            return []
        query = (
            query.join(Paiement, Paiement.id == Quittance.paiement_id)
            .join(Echeance, Echeance.id == Paiement.echeance_id)
            .join(Bail, Bail.id == Echeance.bail_id)
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
        query = (
            query.join(Paiement, Paiement.id == Quittance.paiement_id)
            .join(Echeance, Echeance.id == Paiement.echeance_id)
            .join(Bail, Bail.id == Echeance.bail_id)
            .filter(Bail.locataire_id == current_user.id)
        )
    return query.offset(skip).limit(limit).all()


def get_quittance(db: Session, current_user: Utilisateur, quittance_id: int) -> Quittance:
    quittance = (
        db.query(Quittance)
        .filter(Quittance.id == quittance_id, Quittance.deleted_at.is_(None))
        .first()
    )
    if not quittance:
        raise NotFound("Receipt not found")
    if not _can_view_quittance(db, current_user, quittance):
        raise Forbidden("Not allowed to access this receipt")
    return quittance


def get_quittance_pdf_path(db: Session, current_user: Utilisateur, quittance_id: int) -> str:
    """Return the filesystem path to the receipt PDF, (re-)generating it if missing."""
    quittance = get_quittance(db, current_user, quittance_id)
    if not quittance.fichier_pdf or not Path(quittance.fichier_pdf).is_file():
        quittance.fichier_pdf = generate_receipt_pdf(db, quittance)
        db.commit()
    return quittance.fichier_pdf
