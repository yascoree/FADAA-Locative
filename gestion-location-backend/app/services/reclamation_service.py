from datetime import datetime, timedelta

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.discussion import Discussion
from app.models.notification import NotificationType
from app.models.reclamation import Reclamation, ReclamationStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.reclamation import ReclamationCreate, ReclamationUpdate
from app.services.exceptions import BadRequest, NotFound
from app.services.push_service import notify_admins

# Une réclamation acceptée n'ouvre l'accès à la messagerie admin que tant que
# la conversation reste active : 24h sans message des deux côtés et elle
# expire, le propriétaire doit alors en soumettre une nouvelle.
RECLAMATION_INACTIVITY_TIMEOUT = timedelta(hours=24)


def _last_contact_activity(db: Session, reclamation: Reclamation) -> datetime:
    if not reclamation.traite_par_id:
        return reclamation.date_traitement or reclamation.date_creation
    last_message = (
        db.query(Discussion)
        .filter(
            Discussion.deleted_at.is_(None),
            or_(
                and_(
                    Discussion.user_id == reclamation.proprietaire_id,
                    Discussion.destinataire_id == reclamation.traite_par_id,
                ),
                and_(
                    Discussion.user_id == reclamation.traite_par_id,
                    Discussion.destinataire_id == reclamation.proprietaire_id,
                ),
            ),
        )
        .order_by(Discussion.date_sent.desc())
        .first()
    )
    if last_message:
        return last_message.date_sent
    return reclamation.date_traitement or reclamation.date_creation


def is_reclamation_expired(db: Session, reclamation: Reclamation) -> bool:
    if reclamation.statut != ReclamationStatus.ACCEPTEE:
        return False
    last_activity = _last_contact_activity(db, reclamation)
    return datetime.utcnow() - last_activity > RECLAMATION_INACTIVITY_TIMEOUT


def _attach_expiry_flag(db: Session, reclamation: Reclamation) -> Reclamation:
    reclamation.expiree = is_reclamation_expired(db, reclamation)
    return reclamation


def list_reclamations(db: Session, current_user: Utilisateur) -> list[Reclamation]:
    query = db.query(Reclamation)
    if current_user.role != UtilisateurRole.ADMINISTRATEUR:
        query = query.filter(Reclamation.proprietaire_id == current_user.id)
    reclamations = query.order_by(Reclamation.date_creation.desc()).all()
    return [_attach_expiry_flag(db, r) for r in reclamations]


def create_reclamation(db: Session, current_user: Utilisateur, reclamation_in: ReclamationCreate) -> Reclamation:
    reclamation = Reclamation(
        proprietaire_id=current_user.id,
        sujet=reclamation_in.sujet,
        message=reclamation_in.message,
    )
    db.add(reclamation)
    db.commit()
    db.refresh(reclamation)

    notify_admins(
        db,
        title="Nouvelle réclamation",
        body=f"{current_user.prenom} {current_user.nom} : {reclamation.sujet}",
        notif_type=NotificationType.RECLAMATION,
        reference_id=reclamation.id,
    )

    return _attach_expiry_flag(db, reclamation)


def update_reclamation_statut(
    db: Session, current_user: Utilisateur, reclamation_id: int, reclamation_in: ReclamationUpdate
) -> Reclamation:
    reclamation = db.get(Reclamation, reclamation_id)
    if not reclamation:
        raise NotFound("Reclamation not found")
    if reclamation.statut != ReclamationStatus.EN_ATTENTE:
        raise BadRequest("Reclamation already processed")

    reclamation.statut = reclamation_in.statut
    reclamation.date_traitement = datetime.utcnow()
    reclamation.traite_par_id = current_user.id
    db.commit()
    db.refresh(reclamation)
    return _attach_expiry_flag(db, reclamation)
