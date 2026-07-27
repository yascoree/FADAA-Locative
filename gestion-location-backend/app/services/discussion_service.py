import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import managed_proprietaire_ids
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.discussion import Discussion
from app.models.lot import Lot
from app.models.mandat import Mandat, MandatStatus
from app.models.notification import NotificationType
from app.models.reclamation import Reclamation, ReclamationStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.discussion import DiscussionCreate, DiscussionUpdate
from app.services import reclamation_service
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.push_service import send_push_to_user

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "discussions"
ALLOWED_ATTACHMENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "text/plain": ".txt",
    "application/zip": ".zip",
}
MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024  # 15 MB


def upload_attachment(
    current_user: Utilisateur, file_content: bytes, content_type: str, original_filename: str
) -> dict:
    extension = ALLOWED_ATTACHMENT_TYPES.get(content_type)
    if not extension:
        raise BadRequest("Unsupported file type")
    if len(file_content) > MAX_ATTACHMENT_SIZE:
        raise BadRequest("File must be smaller than 15 MB")

    user_dir = UPLOAD_ROOT / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (user_dir / filename).write_bytes(file_content)

    return {
        "piece_jointe": f"/uploads/discussions/{current_user.id}/{filename}",
        "piece_jointe_nom": original_filename or filename,
        "piece_jointe_type": content_type,
    }


def _ensure_participant_or_admin(current_user: Utilisateur, discussion: Discussion) -> None:
    if current_user.role == UtilisateurRole.ADMINISTRATEUR:
        return
    if current_user.id not in (discussion.user_id, discussion.destinataire_id):
        raise Forbidden("Not allowed to access this discussion")


def _ensure_sender_or_admin(current_user: Utilisateur, discussion: Discussion) -> None:
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != discussion.user_id:
        raise Forbidden("Not allowed to modify this discussion")


def _ensure_owner_or_admin(current_user: Utilisateur, discussion: Discussion) -> None:
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != discussion.user_id:
        raise Forbidden("Not allowed to delete this discussion")


def _is_legitimate_contact(db: Session, current_user: Utilisateur, destinataire: Utilisateur) -> bool:
    """A message can only be sent to someone the sender has a real relationship with in
    the app (lease or mandate) — not to just any user."""
    if current_user.role == UtilisateurRole.ADMINISTRATEUR:
        return True

    # A proprietaire can message the admin only after one of their complaints has been
    # accepted by that specific admin, and only while the conversation stays active
    # (see reclamation_service.is_reclamation_expired — 24h of silence locks it back).
    if destinataire.role == UtilisateurRole.ADMINISTRATEUR:
        if current_user.role != UtilisateurRole.PROPRIETAIRE:
            return False
        reclamation = (
            db.query(Reclamation)
            .filter(
                Reclamation.proprietaire_id == current_user.id,
                Reclamation.traite_par_id == destinataire.id,
                Reclamation.statut == ReclamationStatus.ACCEPTEE,
            )
            .order_by(Reclamation.date_traitement.desc())
            .first()
        )
        if reclamation is None:
            return False
        return not reclamation_service.is_reclamation_expired(db, reclamation)

    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        if destinataire.role == UtilisateurRole.LOCATAIRE:
            return (
                db.query(Bail)
                .join(Lot, Lot.id == Bail.lot_id)
                .join(Bien, Bien.id == Lot.bien_id)
                .filter(Bien.proprietaire_id == current_user.id, Bail.locataire_id == destinataire.id)
                .first()
                is not None
            )
        if destinataire.role == UtilisateurRole.GESTIONNAIRE:
            return (
                db.query(Mandat)
                .filter(
                    Mandat.proprietaire_id == current_user.id,
                    Mandat.gestionnaire_id == destinataire.id,
                    Mandat.statut == MandatStatus.ACTIF,
                )
                .first()
                is not None
            )
        return False

    if current_user.role == UtilisateurRole.LOCATAIRE:
        if destinataire.role != UtilisateurRole.PROPRIETAIRE:
            return False
        return (
            db.query(Bail)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bail.locataire_id == current_user.id, Bien.proprietaire_id == destinataire.id)
            .first()
            is not None
        )

    if current_user.role == UtilisateurRole.GESTIONNAIRE:
        if destinataire.role == UtilisateurRole.PROPRIETAIRE:
            return (
                db.query(Mandat)
                .filter(
                    Mandat.gestionnaire_id == current_user.id,
                    Mandat.proprietaire_id == destinataire.id,
                    Mandat.statut == MandatStatus.ACTIF,
                )
                .first()
                is not None
            )
        if destinataire.role == UtilisateurRole.LOCATAIRE:
            ids = managed_proprietaire_ids(db, current_user.id)
            if not ids:
                return False
            return (
                db.query(Bail)
                .join(Lot, Lot.id == Bail.lot_id)
                .join(Bien, Bien.id == Lot.bien_id)
                .filter(Bien.proprietaire_id.in_(ids), Bail.locataire_id == destinataire.id)
                .first()
                is not None
            )
        return False

    return False


def list_discussions(
    db: Session,
    current_user: Utilisateur,
    skip: int = 0,
    limit: int = 200,
    with_user_id: Optional[int] = None,
) -> list[Discussion]:
    query = db.query(Discussion).filter(
        Discussion.deleted_at.is_(None),
        or_(
            Discussion.user_id == current_user.id,
            Discussion.destinataire_id == current_user.id,
        ),
    )
    if with_user_id is not None:
        query = query.filter(
            or_(
                (Discussion.user_id == current_user.id) & (Discussion.destinataire_id == with_user_id),
                (Discussion.user_id == with_user_id) & (Discussion.destinataire_id == current_user.id),
            )
        )
    return query.order_by(Discussion.date_sent.asc()).offset(skip).limit(limit).all()


def get_discussion(db: Session, current_user: Utilisateur, discussion_id: int) -> Discussion:
    discussion = (
        db.query(Discussion)
        .filter(Discussion.id == discussion_id, Discussion.deleted_at.is_(None))
        .first()
    )
    if not discussion:
        raise NotFound("Discussion not found")
    _ensure_participant_or_admin(current_user, discussion)
    return discussion


def create_discussion(db: Session, current_user: Utilisateur, discussion_in: DiscussionCreate) -> Discussion:
    destinataire = db.get(Utilisateur, discussion_in.destinataire_id)
    if not destinataire:
        raise NotFound("Recipient not found")
    if not _is_legitimate_contact(db, current_user, destinataire):
        raise Forbidden("Cannot message this user")

    discussion = Discussion(
        user_id=current_user.id,
        destinataire_id=discussion_in.destinataire_id,
        message=discussion_in.message,
        piece_jointe=discussion_in.piece_jointe,
        piece_jointe_nom=discussion_in.piece_jointe_nom,
        piece_jointe_type=discussion_in.piece_jointe_type,
    )
    db.add(discussion)
    db.commit()
    db.refresh(discussion)

    send_push_to_user(
        db,
        user_id=discussion.destinataire_id,
        title=f"Message de {current_user.prenom} {current_user.nom}",
        body=discussion.message[:150] if discussion.message else "Vous avez reçu un nouveau message.",
        notif_type=NotificationType.DISCUSSION,
        reference_id=current_user.id,
    )

    return discussion


def update_discussion(
    db: Session, current_user: Utilisateur, discussion_id: int, discussion_in: DiscussionUpdate
) -> Discussion:
    discussion = (
        db.query(Discussion)
        .filter(Discussion.id == discussion_id, Discussion.deleted_at.is_(None))
        .first()
    )
    if not discussion:
        raise NotFound("Discussion not found")
    _ensure_sender_or_admin(current_user, discussion)
    for field, value in discussion_in.model_dump(exclude_unset=True).items():
        setattr(discussion, field, value)
    db.commit()
    db.refresh(discussion)
    return discussion


def delete_discussion(db: Session, current_user: Utilisateur, discussion_id: int) -> None:
    discussion = (
        db.query(Discussion)
        .filter(Discussion.id == discussion_id, Discussion.deleted_at.is_(None))
        .first()
    )
    if not discussion:
        raise NotFound("Discussion not found")
    _ensure_owner_or_admin(current_user, discussion)
    discussion.deleted_at = datetime.utcnow()
    db.commit()
