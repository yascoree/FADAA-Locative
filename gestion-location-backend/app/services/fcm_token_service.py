from sqlalchemy.orm import Session

from app.models.fcm_token import FCMToken
from app.models.utilisateur import Utilisateur
from app.schemas.fcm_token import FCMTokenCreate


def register_token(db: Session, current_user: Utilisateur, token_in: FCMTokenCreate) -> FCMToken:
    """Register the current user's device token. Idempotent: re-registering a known
    token reassigns it to the caller."""
    existing = db.query(FCMToken).filter(FCMToken.token == token_in.token).first()
    if existing:
        existing.user_id = current_user.id
        db.commit()
        db.refresh(existing)
        return existing

    fcm_token = FCMToken(user_id=current_user.id, token=token_in.token)
    db.add(fcm_token)
    db.commit()
    db.refresh(fcm_token)
    return fcm_token


def unregister_token(db: Session, current_user: Utilisateur, token: str) -> None:
    db.query(FCMToken).filter(FCMToken.token == token, FCMToken.user_id == current_user.id).delete()
    db.commit()
