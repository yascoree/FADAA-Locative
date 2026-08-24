import uuid
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import (
    bien_ids_with_permission,
    can_access_proprietaire,
    gestionnaire_ids_for_proprietaire,
    has_permission_for_bien,
)
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.notification import NotificationType
from app.models.paiement import ModePaiement, Paiement, PaiementStatus
from app.models.quittance import Quittance, QuittanceStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.paiement import PaiementCreate, PaiementEncaissement
from app.services.echeance_service import sync_echeance_statut
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.push_service import send_push_to_user
from app.services.receipt_service import generate_receipt_pdf
from app.services.usage_service import enforce_limit

# Un chèque ou un virement n'est pas immédiatement liquide : son montant ne
# rejoint les revenus (stats_service.get_revenue_stats) qu'après confirmation
# explicite de l'encaissement (voir confirmer_encaissement).
MODES_ENCAISSEMENT_DIFFERE = {ModePaiement.CHEQUE, ModePaiement.VIREMENT}


def _chain_for_paiement(db: Session, echeance_id: int):
    echeance = (
        db.query(Echeance)
        .filter(Echeance.id == echeance_id, Echeance.deleted_at.is_(None))
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


def _can_view_paiement(db: Session, user: Utilisateur, paiement: Paiement) -> bool:
    bail, bien = _chain_for_paiement(db, paiement.echeance_id)
    if user.role == UtilisateurRole.LOCATAIRE and user.id == bail.locataire_id:
        return True
    return bool(bien) and has_permission_for_bien(db, user, bien, "VIEW_PAYMENT")


def list_paiements(
    db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100, proprietaire_id: int | None = None
) -> list[Paiement]:
    if proprietaire_id is not None and not can_access_proprietaire(db, current_user, proprietaire_id):
        raise Forbidden("Not allowed to access this proprietaire")
    query = db.query(Paiement).filter(Paiement.deleted_at.is_(None))
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = (
            query.join(Echeance, Echeance.id == Paiement.echeance_id)
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
            query.join(Echeance, Echeance.id == Paiement.echeance_id)
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
            query.join(Echeance, Echeance.id == Paiement.echeance_id)
            .join(Bail, Bail.id == Echeance.bail_id)
            .filter(Bail.locataire_id == current_user.id)
        )
    if proprietaire_id is not None:
        if current_user.role == UtilisateurRole.LOCATAIRE:
            query = query.join(Lot, Lot.id == Bail.lot_id).join(Bien, Bien.id == Lot.bien_id)
        query = query.filter(
            Bien.proprietaire_id == proprietaire_id,
            Bail.deleted_at.is_(None),
            Lot.deleted_at.is_(None),
            Bien.deleted_at.is_(None),
        )
    return query.offset(skip).limit(limit).all()


def get_paiement(db: Session, current_user: Utilisateur, paiement_id: int) -> Paiement:
    paiement = (
        db.query(Paiement)
        .filter(Paiement.id == paiement_id, Paiement.deleted_at.is_(None))
        .first()
    )
    if not paiement:
        raise NotFound("Payment not found")
    if not _can_view_paiement(db, current_user, paiement):
        raise Forbidden("Not allowed to access this payment")
    return paiement


def create_paiement(db: Session, current_user: Utilisateur, paiement_in: PaiementCreate) -> Paiement:
    bail, bien = _chain_for_paiement(db, paiement_in.echeance_id)
    if not bail:
        raise NotFound("Due date not found")

    is_tenant = current_user.role == UtilisateurRole.LOCATAIRE and current_user.id == bail.locataire_id
    if not is_tenant and not has_permission_for_bien(db, current_user, bien, "CREATE_PAYMENT"):
        raise Forbidden("Not allowed to record this payment")

    echeance = db.get(Echeance, paiement_in.echeance_id)
    if echeance and echeance.montant_du is not None and paiement_in.montant is not None:
        deja_paye = (
            db.query(func.coalesce(func.sum(Paiement.montant), 0))
            .filter(
                Paiement.echeance_id == echeance.id,
                Paiement.deleted_at.is_(None),
                Paiement.statut == PaiementStatus.VALIDE,
            )
            .scalar()
        ) or Decimal("0")
        reste = echeance.montant_du - deja_paye
        if paiement_in.montant > reste:
            raise BadRequest(
                f"Le montant saisi ({paiement_in.montant} MAD) dépasse le reste à payer sur cette "
                f"échéance ({reste} MAD)."
            )

    # Chaque paiement génère systématiquement une quittance (voir plus bas) : la
    # limite mensuelle de quittances du plan gate donc la création du paiement
    # lui-même, avant toute écriture, pour ne jamais laisser un paiement orphelin
    # sans quittance.
    if bien:
        enforce_limit(db, current_user, "quittances_mois", target_proprietaire_id=bien.proprietaire_id)

    paiement_data = paiement_in.model_dump()
    encaisse = paiement_in.mode_paiement not in MODES_ENCAISSEMENT_DIFFERE
    paiement = Paiement(
        **paiement_data,
        encaisse_par=current_user.id,
        encaisse=encaisse,
        date_encaissement=datetime.utcnow() if encaisse else None,
    )
    db.add(paiement)
    db.commit()
    db.refresh(paiement)

    echeance = db.get(Echeance, paiement.echeance_id)
    if echeance:
        sync_echeance_statut(db, echeance)

    # A receipt (quittance) is auto-generated for every payment, PDF included.
    quittance = Quittance(paiement_id=paiement.id)
    db.add(quittance)
    db.commit()
    db.refresh(quittance)

    quittance.fichier_pdf = generate_receipt_pdf(db, quittance)
    db.commit()

    send_push_to_user(
        db,
        user_id=bail.locataire_id,
        title="Quittance émise",
        body=f"Votre quittance de {paiement.montant} MAD a été générée.",
        notif_type=NotificationType.PAIEMENT,
        reference_id=quittance.id,
    )
    if bien:
        # Le propriétaire et les gestionnaires mandatés doivent aussi être avertis
        # des encaissements sur les biens dont ils ont la charge, pas seulement le locataire.
        # On ne notifie jamais l'auteur de l'action à propos de sa propre action.
        stakeholder_ids = {bien.proprietaire_id, *gestionnaire_ids_for_proprietaire(db, bien.proprietaire_id)}
        stakeholder_ids.discard(current_user.id)
        is_gestionnaire_action = current_user.role == UtilisateurRole.GESTIONNAIRE
        body = (
            f"{current_user.prenom} {current_user.nom} (gestionnaire) a enregistré un paiement de "
            f"{paiement.montant} MAD pour {bien.designation}."
            if is_gestionnaire_action
            else f"Un paiement de {paiement.montant} MAD a été encaissé pour {bien.designation}."
        )
        for stakeholder_id in stakeholder_ids:
            send_push_to_user(
                db,
                user_id=stakeholder_id,
                title="Paiement encaissé",
                body=body,
                notif_type=NotificationType.PAIEMENT,
                reference_id=quittance.id,
            )

    return paiement


def delete_paiement(db: Session, current_user: Utilisateur, paiement_id: int) -> None:
    paiement = (
        db.query(Paiement)
        .filter(Paiement.id == paiement_id, Paiement.deleted_at.is_(None))
        .first()
    )
    if not paiement:
        raise NotFound("Payment not found")
    _, bien = _chain_for_paiement(db, paiement.echeance_id)
    if not has_permission_for_bien(db, current_user, bien, "DELETE_PAYMENT"):
        raise Forbidden("Not allowed to delete this payment")
    # Un paiement validé ne se supprime jamais physiquement — seule l'annulation
    # (statut ANNULE) est permise, pour préserver l'historique financier.
    if paiement.statut == PaiementStatus.VALIDE:
        raise BadRequest("Impossible de supprimer un paiement validé. Utilisez plutôt l'action Annuler.")
    # Une quittance est une preuve documentaire : on ne la cascade-supprime jamais.
    # Si une quittance existe, le paiement doit être annulé (voir annuler_paiement),
    # pas supprimé — l'historique financier reste intact.
    quittance = db.query(Quittance).filter(Quittance.paiement_id == paiement.id, Quittance.deleted_at.is_(None)).first()
    if quittance:
        raise BadRequest("Impossible de supprimer ce paiement : une quittance y est associée. Utilisez plutôt l'action Annuler.")
    paiement.deleted_at = datetime.utcnow()
    db.commit()
    echeance = db.get(Echeance, paiement.echeance_id)
    if echeance:
        sync_echeance_statut(db, echeance)


def annuler_paiement(db: Session, current_user: Utilisateur, paiement_id: int, motif: str | None = None) -> Paiement:
    """Action métier distincte du Delete : marque le paiement comme ANNULE sans le
    retirer de l'historique, et annule la quittance associée le cas échéant.
    Trace qui a annulé, quand, et pourquoi (annule_par/date_annulation/motif) —
    l'action elle-même est déjà journalisée dans l'audit par HistoriqueMiddleware."""
    paiement = (
        db.query(Paiement)
        .filter(Paiement.id == paiement_id, Paiement.deleted_at.is_(None))
        .first()
    )
    if not paiement:
        raise NotFound("Payment not found")
    bail, bien = _chain_for_paiement(db, paiement.echeance_id)
    if not has_permission_for_bien(db, current_user, bien, "UPDATE_PAYMENT"):
        raise Forbidden("Not allowed to modify this payment")
    if paiement.statut == PaiementStatus.ANNULE:
        raise BadRequest("Impossible d'annuler ce paiement : il est déjà annulé.")
    paiement.statut = PaiementStatus.ANNULE
    paiement.annule_par = current_user.id
    paiement.date_annulation = datetime.utcnow()
    paiement.motif_annulation = motif
    quittance = db.query(Quittance).filter(Quittance.paiement_id == paiement.id, Quittance.deleted_at.is_(None)).first()
    if quittance and quittance.statut == QuittanceStatus.EMISE:
        quittance.statut = QuittanceStatus.ANNULEE
        db.commit()
        db.refresh(quittance)
        # Même document, régénéré pour afficher la référence d'annulation
        # (qui a annulé, quand) sans créer de second fichier.
        quittance.fichier_pdf = generate_receipt_pdf(db, quittance)
    db.commit()
    db.refresh(paiement)
    echeance = db.get(Echeance, paiement.echeance_id)
    if echeance:
        sync_echeance_statut(db, echeance)

    if bail and current_user.id != bail.locataire_id:
        send_push_to_user(
            db,
            user_id=bail.locataire_id,
            title="Paiement annulé",
            body=f"Votre paiement de {paiement.montant} MAD a été annulé par {current_user.prenom} {current_user.nom}.",
            notif_type=NotificationType.PAIEMENT,
            reference_id=paiement.id,
        )
    return paiement


def confirmer_encaissement(
    db: Session, current_user: Utilisateur, paiement_id: int, data: PaiementEncaissement
) -> Paiement:
    """Bascule un paiement chèque/virement en 'encaissé' : c'est seulement à partir de
    ce moment que son montant rejoint les revenus (voir MODES_ENCAISSEMENT_DIFFERE et
    stats_service.get_revenue_stats)."""
    paiement = (
        db.query(Paiement)
        .filter(Paiement.id == paiement_id, Paiement.deleted_at.is_(None))
        .first()
    )
    if not paiement:
        raise NotFound("Payment not found")
    bail, bien = _chain_for_paiement(db, paiement.echeance_id)
    if not has_permission_for_bien(db, current_user, bien, "UPDATE_PAYMENT"):
        raise Forbidden("Not allowed to modify this payment")
    if paiement.statut != PaiementStatus.VALIDE:
        raise BadRequest("Impossible de confirmer l'encaissement d'un paiement annulé.")
    if paiement.encaisse:
        raise BadRequest("Ce paiement est déjà marqué comme encaissé.")

    paiement.encaisse = True
    paiement.date_encaissement = data.date_encaissement or datetime.utcnow()
    if data.agence_bancaire is not None:
        paiement.agence_bancaire = data.agence_bancaire
    if data.reference_paiement is not None:
        paiement.reference_paiement = data.reference_paiement
    if data.justificatif is not None:
        paiement.justificatif = data.justificatif
        paiement.justificatif_nom = data.justificatif_nom
    db.commit()
    db.refresh(paiement)
    return paiement


UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "paiements"
ALLOWED_JUSTIFICATIF_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}
MAX_JUSTIFICATIF_SIZE = 15 * 1024 * 1024  # 15 MB


def upload_justificatif(current_user: Utilisateur, file_content: bytes, content_type: str, original_filename: str) -> dict:
    extension = ALLOWED_JUSTIFICATIF_TYPES.get(content_type)
    if not extension:
        raise BadRequest("Type de fichier non pris en charge (PDF ou image uniquement).")
    if len(file_content) > MAX_JUSTIFICATIF_SIZE:
        raise BadRequest("Le fichier doit faire moins de 15 Mo.")

    user_dir = UPLOAD_ROOT / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (user_dir / filename).write_bytes(file_content)

    return {
        "justificatif": f"/uploads/paiements/{current_user.id}/{filename}",
        "justificatif_nom": original_filename or filename,
    }
