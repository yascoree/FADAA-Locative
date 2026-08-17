from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.notification import NotificationType
from app.models.reclamation import Reclamation, ReclamationStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.reclamation import ReclamationCreate, ReclamationUpdate
from app.services.exceptions import BadRequest, NotFound
from app.services.push_service import notify_admins


def list_reclamations(db: Session, current_user: Utilisateur) -> list[Reclamation]:
    query = db.query(Reclamation)
    if current_user.role != UtilisateurRole.ADMINISTRATEUR:
        query = query.filter(Reclamation.proprietaire_id == current_user.id)
    return query.order_by(Reclamation.date_creation.desc()).all()


def create_reclamation(db: Session, current_user: Utilisateur, reclamation_in: ReclamationCreate) -> Reclamation:
    sujet = reclamation_in.sujet.strip()

    # Empêche de rouvrir un sujet déjà tranché : une fois une réclamation acceptée
    # sur ce sujet précis, seul un sujet différent peut donner lieu à une nouvelle
    # réclamation (les réclamations en attente ou rejetées ne bloquent rien).
    already_accepted = (
        db.query(Reclamation)
        .filter(
            Reclamation.proprietaire_id == current_user.id,
            Reclamation.statut == ReclamationStatus.ACCEPTEE,
            func.lower(Reclamation.sujet) == sujet.lower(),
        )
        .first()
    )
    if already_accepted:
        raise BadRequest("A reclamation with this subject has already been accepted")

    reclamation = Reclamation(
        proprietaire_id=current_user.id,
        sujet=sujet,
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

    return reclamation


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
    return reclamation
