from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.avis import Avis, AvisStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.avis import AvisCreate, AvisUpdate
from app.services.exceptions import Forbidden, NotFound


def list_avis(db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100) -> list[Avis]:
    query = db.query(Avis).filter(Avis.deleted_at.is_(None))
    if current_user.role != UtilisateurRole.ADMINISTRATEUR:
        query = query.filter(or_(Avis.statut == AvisStatus.PUBLIE, Avis.user_id == current_user.id))
    return query.offset(skip).limit(limit).all()


def get_avis(db: Session, current_user: Utilisateur, avis_id: int) -> Avis:
    avis = db.get(Avis, avis_id)
    if not avis:
        raise NotFound("Avis not found")
    is_owner_or_admin = current_user.role == UtilisateurRole.ADMINISTRATEUR or current_user.id == avis.user_id
    if not is_owner_or_admin and avis.statut != AvisStatus.PUBLIE:
        raise Forbidden("Not allowed to access this review")
    return avis


def create_avis(db: Session, current_user: Utilisateur, avis_in: AvisCreate) -> Avis:
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and avis_in.user_id != current_user.id:
        raise Forbidden("Cannot create a review for another user")
    avis = Avis(**avis_in.model_dump())
    db.add(avis)
    db.commit()
    db.refresh(avis)
    return avis


def update_avis(db: Session, avis_id: int, avis_in: AvisUpdate) -> Avis:
    """Moderation — admin only (enforced at the router level)."""
    avis = db.get(Avis, avis_id)
    if not avis:
        raise NotFound("Avis not found")
    for field, value in avis_in.model_dump(exclude_unset=True).items():
        setattr(avis, field, value)
    db.commit()
    db.refresh(avis)
    return avis


def delete_avis(db: Session, current_user: Utilisateur, avis_id: int) -> None:
    avis = db.get(Avis, avis_id)
    if not avis:
        raise NotFound("Avis not found")
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != avis.user_id:
        raise Forbidden("Not allowed to delete this review")
    avis.deleted_at = datetime.utcnow()
    db.commit()
