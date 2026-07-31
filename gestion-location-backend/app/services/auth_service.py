from typing import Optional

from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_access_token,
    decode_password_reset_token,
    hash_password,
    password_fingerprint,
    verify_password,
)
from app.models.utilisateur import StatutCompte, Utilisateur, UtilisateurRole
from app.schemas.auth import Token
from app.schemas.utilisateur import UtilisateurCreate
from app.services import subscription_service
from app.services.email_service import send_email
from app.services.exceptions import BadRequest, Forbidden, NotFound

PUBLIC_REGISTER_ROLES = (UtilisateurRole.PROPRIETAIRE,)


def register(db: Session, utilisateur_in: UtilisateurCreate) -> Utilisateur:
    """Public registration — Proprietaire only. A Gestionnaire has no self-service
    signup: their account is created by a proprietaire (see
    utilisateur_service.create_gestionnaire_invite), which is the only way they get
    access. Admin/Locataire are also excluded (created via mandate or by an admin)."""
    if utilisateur_in.role not in PUBLIC_REGISTER_ROLES:
        raise BadRequest("role must be PROPRIETAIRE")

    existing = db.query(Utilisateur).filter(Utilisateur.email == utilisateur_in.email).first()
    if existing:
        raise BadRequest("Email already registered")

    utilisateur = Utilisateur(
        nom=utilisateur_in.nom,
        prenom=utilisateur_in.prenom,
        email=utilisateur_in.email,
        mot_de_passe=hash_password(utilisateur_in.mot_de_passe),
        role=utilisateur_in.role,
        statut_compte=utilisateur_in.statut_compte,
        cree_par_id=utilisateur_in.cree_par_id,
    )
    db.add(utilisateur)
    db.commit()
    db.refresh(utilisateur)

    # Each proprietaire starts automatically with a free trial subscription.
    # Gestionnaires have no subscription of their own.
    if utilisateur.role == UtilisateurRole.PROPRIETAIRE:
        subscription_service.create_trial_subscription(db, utilisateur.id)

    return utilisateur


def login(db: Session, email: str, password: str) -> Token:
    utilisateur = db.query(Utilisateur).filter(Utilisateur.email == email).first()
    if not utilisateur or not verify_password(password, utilisateur.mot_de_passe):
        raise Forbidden("Incorrect email or password")
    if utilisateur.statut_compte != StatutCompte.ACTIF:
        raise Forbidden("Account is not active")

    access_token = create_access_token(data={"sub": str(utilisateur.id)})
    refresh_token = create_refresh_token(data={"sub": str(utilisateur.id)})
    return Token(access_token=access_token, refresh_token=refresh_token)


def refresh(db: Session, refresh_token: str) -> Token:
    try:
        payload = decode_access_token(refresh_token)
    except JWTError:
        raise Forbidden("Invalid refresh token")

    if payload.get("type") != "refresh":
        raise Forbidden("Invalid refresh token")

    utilisateur_id = payload.get("sub")
    utilisateur = db.get(Utilisateur, int(utilisateur_id)) if utilisateur_id is not None else None
    if utilisateur is None or utilisateur.statut_compte != StatutCompte.ACTIF:
        raise Forbidden("Invalid refresh token")

    access_token = create_access_token(data={"sub": utilisateur_id})
    return Token(access_token=access_token)


def request_password_reset(db: Session, email: str) -> Optional[str]:
    """Never reveals whether the email is registered (anti-enumeration): the caller
    always gets the same generic response regardless of what happens here.

    Returns the reset link only when it could NOT be emailed (SMTP not configured,
    or send failure) — the API surfaces that as a test-mode convenience. Once SMTP
    is configured, this returns None on the happy path, exactly like production."""
    utilisateur = db.query(Utilisateur).filter(Utilisateur.email == email).first()
    if not utilisateur:
        return None

    token = create_password_reset_token(utilisateur.id, utilisateur.mot_de_passe)
    reset_link = f"{settings.frontend_base_url}/front/reset-password?token={token}"

    html_body = f"""
    <p>Bonjour {utilisateur.prenom},</p>
    <p>Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe
    (valable {settings.password_reset_token_expire_minutes} minutes) :</p>
    <p><a href="{reset_link}">{reset_link}</a></p>
    <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    """
    sent = send_email(utilisateur.email, "Réinitialisation de votre mot de passe FADAA Locative", html_body)
    return None if sent else reset_link


def reset_password(db: Session, token: str, new_password: str) -> None:
    try:
        payload = decode_password_reset_token(token)
    except JWTError:
        raise BadRequest("Invalid or expired link")

    utilisateur_id = payload.get("sub")
    utilisateur = db.get(Utilisateur, int(utilisateur_id)) if utilisateur_id is not None else None
    if utilisateur is None:
        raise BadRequest("Invalid or expired link")

    if password_fingerprint(utilisateur.mot_de_passe) != payload.get("pwd_fp"):
        # Password already changed since this link was issued (via this same flow,
        # or any other) — the fingerprint no longer matches, so the link is dead.
        raise BadRequest("This link has already been used")

    utilisateur.mot_de_passe = hash_password(new_password)
    if utilisateur.statut_compte == StatutCompte.INVITE_EN_ATTENTE:
        # Un gestionnaire invité (voir create_gestionnaire_invite) est créé dans cet
        # état avec un mot de passe aléatoire inutilisable : choisir son propre mot
        # de passe via ce même flux d'activation le fait passer ACTIF.
        utilisateur.statut_compte = StatutCompte.ACTIF
    db.commit()
