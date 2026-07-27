from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.notification import NotificationCreate, NotificationUpdate
from app.services.exceptions import Forbidden, NotFound


def _ensure_owner_or_admin(current_user: Utilisateur, notification: Notification) -> None:
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != notification.user_id:
        raise Forbidden("Not allowed to access this notification")


def list_notifications(db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100) -> list[Notification]:
    # Toujours filtré sur l'utilisateur courant, y compris pour l'admin : la liste
    # alimente la cloche/page notifications personnelles, pas un flux global (qui
    # existe déjà via le journal d'activité). _ensure_owner_or_admin plus bas garde
    # néanmoins l'accès admin à une notification précise par id, pour le support.
    return db.query(Notification).filter(Notification.user_id == current_user.id).offset(skip).limit(limit).all()


def get_notification(db: Session, current_user: Utilisateur, notification_id: int) -> Notification:
    notification = db.get(Notification, notification_id)
    if not notification:
        raise NotFound("Notification not found")
    _ensure_owner_or_admin(current_user, notification)
    return notification


def create_notification(db: Session, current_user: Utilisateur, notification_in: NotificationCreate) -> Notification:
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and notification_in.user_id != current_user.id:
        raise Forbidden("Cannot create a notification for another user")
    notification = Notification(**notification_in.model_dump())
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def update_notification(
    db: Session, current_user: Utilisateur, notification_id: int, notification_in: NotificationUpdate
) -> Notification:
    notification = db.get(Notification, notification_id)
    if not notification:
        raise NotFound("Notification not found")
    _ensure_owner_or_admin(current_user, notification)
    for field, value in notification_in.model_dump(exclude_unset=True).items():
        setattr(notification, field, value)
    db.commit()
    db.refresh(notification)
    return notification


def delete_notification(db: Session, current_user: Utilisateur, notification_id: int) -> None:
    notification = db.get(Notification, notification_id)
    if not notification:
        raise NotFound("Notification not found")
    _ensure_owner_or_admin(current_user, notification)
    db.delete(notification)
    db.commit()
