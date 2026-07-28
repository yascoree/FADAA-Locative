from datetime import datetime

from sqlalchemy.orm import Session

from app.api.deps import (
    bien_ids_with_permission,
    gestionnaire_ids_for_proprietaire,
    has_permission_for_bien,
)
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.notification import NotificationType
from app.models.paiement import Paiement, PaiementStatus
from app.models.quittance import Quittance, QuittanceStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.paiement import PaiementCreate
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.push_service import send_push_to_user
from app.services.receipt_service import generate_receipt_pdf


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


def list_paiements(db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100) -> list[Paiement]:
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

    paiement = Paiement(**paiement_in.model_dump(), encaisse_par=current_user.id)
    db.add(paiement)
    db.commit()
    db.refresh(paiement)

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


# def update_paiement(db: Session, current_user: Utilisateur, paiement_id: int, paiement_in: PaiementUpdate) -> Paiement:
#     paiement = (
#         db.query(Paiement)
#         .filter(Paiement.id == paiement_id, Paiement.deleted_at.is_(None))
#         .first()
#     )
#     if not paiement:
#         raise NotFound("Payment not found")
#     _, bien = _chain_for_paiement(db, paiement.echeance_id)
#     if not has_permission_for_bien(db, current_user, bien, "UPDATE_PAYMENT"):
#         raise Forbidden("Not allowed to modify this payment")
#     for field, value in paiement_in.model_dump(exclude_unset=True).items():
#         setattr(paiement, field, value)
#     db.commit()
#     db.refresh(paiement)
#     return paiement


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
    # Une quittance est une preuve documentaire : on ne la cascade-supprime jamais.
    # Si une quittance existe, le paiement doit être annulé (voir annuler_paiement),
    # pas supprimé — l'historique financier reste intact.
    quittance = db.query(Quittance).filter(Quittance.paiement_id == paiement.id, Quittance.deleted_at.is_(None)).first()
    if quittance:
        raise BadRequest("Impossible de supprimer ce paiement : une quittance y est associée. Utilisez plutôt l'action Annuler.")
    paiement.deleted_at = datetime.utcnow()
    db.commit()


def annuler_paiement(db: Session, current_user: Utilisateur, paiement_id: int) -> Paiement:
    """Action métier distincte du Delete : marque le paiement comme ANNULE sans le
    retirer de l'historique, et annule la quittance associée le cas échéant."""
    paiement = (
        db.query(Paiement)
        .filter(Paiement.id == paiement_id, Paiement.deleted_at.is_(None))
        .first()
    )
    if not paiement:
        raise NotFound("Payment not found")
    _, bien = _chain_for_paiement(db, paiement.echeance_id)
    if not has_permission_for_bien(db, current_user, bien, "UPDATE_PAYMENT"):
        raise Forbidden("Not allowed to modify this payment")
    if paiement.statut == PaiementStatus.ANNULE:
        raise BadRequest("Impossible d'annuler ce paiement : il est déjà annulé.")
    paiement.statut = PaiementStatus.ANNULE
    quittance = db.query(Quittance).filter(Quittance.paiement_id == paiement.id, Quittance.deleted_at.is_(None)).first()
    if quittance and quittance.statut == QuittanceStatus.EMISE:
        quittance.statut = QuittanceStatus.ANNULEE
    db.commit()
    db.refresh(paiement)
    return paiement
