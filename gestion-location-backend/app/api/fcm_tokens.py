from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.fcm_token import FCMToken
from app.models.utilisateur import Utilisateur
from app.schemas.fcm_token import FCMTokenCreate, FCMTokenRead

router = APIRouter(prefix="/fcm-tokens", tags=["fcm-tokens"])


@router.post("/", response_model=FCMTokenRead, status_code=status.HTTP_201_CREATED)
def register_token(
    token_in: FCMTokenCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Enregistre le jeton d'appareil de l'utilisateur courant (appelé par le
    frontend juste après l'obtention du jeton FCM côté navigateur/mobile).
    Idempotent : renvoyer un jeton déjà connu le réattribue à l'appelant."""
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


@router.delete("/{token}", status_code=status.HTTP_204_NO_CONTENT)
def unregister_token(
    token: str,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    db.query(FCMToken).filter(FCMToken.token == token, FCMToken.user_id == current_user.id).delete()
    db.commit()
