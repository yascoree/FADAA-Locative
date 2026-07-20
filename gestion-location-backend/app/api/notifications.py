from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.notification import Notification
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.notification import NotificationCreate, NotificationRead, NotificationUpdate

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _ensure_owner_or_admin(current_user: Utilisateur, notification: Notification) -> None:
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != notification.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this notification")


@router.get("/", response_model=list[NotificationRead])
def list_notifications(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Notification)
    if current_user.role != UtilisateurRole.ADMINISTRATEUR:
        query = query.filter(Notification.user_id == current_user.id)
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=NotificationRead, status_code=status.HTTP_201_CREATED)
def create_notification(
    notification_in: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and notification_in.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create a notification for another user"
        )

    notification = Notification(**notification_in.model_dump())
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


@router.get("/{notification_id}", response_model=NotificationRead)
def get_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    _ensure_owner_or_admin(current_user, notification)
    return notification


@router.put("/{notification_id}", response_model=NotificationRead)
def update_notification(
    notification_id: int,
    notification_in: NotificationUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    _ensure_owner_or_admin(current_user, notification)

    for field, value in notification_in.model_dump(exclude_unset=True).items():
        setattr(notification, field, value)

    db.commit()
    db.refresh(notification)
    return notification


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    _ensure_owner_or_admin(current_user, notification)
    db.delete(notification)
    db.commit()
