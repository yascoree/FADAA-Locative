from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.fcm_token import FCMTokenCreate, FCMTokenRead
from app.services import fcm_token_service

router = APIRouter(prefix="/fcm-tokens", tags=["fcm-tokens"])


@router.post("/", response_model=FCMTokenRead, status_code=status.HTTP_201_CREATED)
def register_token(
    token_in: FCMTokenCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Register the current user's device token (called by the frontend right after
    obtaining the FCM token on the browser/mobile side). Idempotent: re-registering
    a known token reassigns it to the caller."""
    return fcm_token_service.register_token(db, current_user, token_in)


@router.delete("/{token}", status_code=status.HTTP_204_NO_CONTENT)
def unregister_token(
    token: str,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    fcm_token_service.unregister_token(db, current_user, token)
