from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import verify_password
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    PasswordVerifyRequest,
    PasswordVerifyResponse,
    RefreshRequest,
    ResetPasswordRequest,
    Token,
)
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurRead
from app.services import auth_service
from app.services.exceptions import BadRequest, Forbidden

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UtilisateurRead, status_code=status.HTTP_201_CREATED)
def register(utilisateur_in: UtilisateurCreate, db: Session = Depends(get_db)):
    """Public registration: Proprietaire or Gestionnaire only (never Admin/Locataire —
    those roles are created via mandate or by an admin respectively)."""
    try:
        return auth_service.register(db, utilisateur_in)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    try:
        return auth_service.login(db, form_data.username, form_data.password)
    except Forbidden as exc:
        detail = str(exc)
        if "not active" in detail.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/refresh", response_model=Token)
def refresh(refresh_in: RefreshRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.refresh(db, refresh_in.refresh_token)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(current_user: Utilisateur = Depends(get_current_user)):
    # JWT is stateless server-side (no blacklist): logout means deleting tokens on the
    # client. Endpoint kept for API symmetry and a future revocation mechanism.
    return {"detail": "Successfully logged out"}


@router.get("/me", response_model=UtilisateurRead)
def read_current_user(current_user: Utilisateur = Depends(get_current_user)):
    return current_user


@router.post("/verify-password", response_model=PasswordVerifyResponse)
def verify_current_password(
    payload: PasswordVerifyRequest,
    current_user: Utilisateur = Depends(get_current_user),
):
    """Checks a plaintext password against the caller's own account — used by the
    settings page to confirm identity before allowing a password change, without
    ever trusting a client-side-only check."""
    return PasswordVerifyResponse(valid=verify_password(payload.password, current_user.mot_de_passe))


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    debug_link = auth_service.request_password_reset(db, payload.email)
    return ForgotPasswordResponse(
        message="Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé.",
        debug_link=debug_link,
    )


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        auth_service.reset_password(db, payload.token, payload.new_password)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {"message": "Mot de passe réinitialisé avec succès."}
