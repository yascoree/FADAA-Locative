from datetime import datetime
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
from app.api.deps import active_agence_id
from app.models.agence import Agence
from app.models.agence_membre import AgenceMembre, AgenceMembreStatus, RoleAgence
from app.models.utilisateur import StatutCompte, Utilisateur, UtilisateurRole
from app.schemas.auth import Token
from app.schemas.utilisateur import UtilisateurCreate
from app.models.subscription_plan import SubscriptionTarget
from app.services import subscription_service
from app.services.email_service import send_email
from app.services.exceptions import BadRequest, Forbidden, NotFound

PUBLIC_REGISTER_ROLES = (UtilisateurRole.PROPRIETAIRE, UtilisateurRole.GESTIONNAIRE)


def register(db: Session, utilisateur_in: UtilisateurCreate) -> Utilisateur:
    """Public registration — Proprietaire or Gestionnaire (self-service "Agence"
    signup). Admin/Locataire are excluded (created via mandate or by an admin).

    A self-registered Gestionnaire becomes the ADMIN of a brand-new single-member
    Agence named after utilisateur_in.agence_nom (required for this role — the
    agence's name is distinct from the responsible person's own name, so it can't
    be derived the way create_gestionnaire_invite does it). They set their own
    password immediately (ACTIF), with no invite/reset-password step in between."""
    if utilisateur_in.role not in PUBLIC_REGISTER_ROLES:
        raise BadRequest("role must be PROPRIETAIRE or GESTIONNAIRE")

    if utilisateur_in.role == UtilisateurRole.GESTIONNAIRE and not (utilisateur_in.agence_nom or "").strip():
        raise BadRequest("agence_nom is required to register as an agence")

    existing = db.query(Utilisateur).filter(Utilisateur.email == utilisateur_in.email).first()
    if existing:
        raise BadRequest("Email already registered")

    if utilisateur_in.role in (UtilisateurRole.PROPRIETAIRE, UtilisateurRole.GESTIONNAIRE):
        target = SubscriptionTarget.AGENCE if utilisateur_in.role == UtilisateurRole.GESTIONNAIRE else SubscriptionTarget.PROPRIETAIRE
        subscription_service.ensure_trial_plan_available(db, target_type=target)

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

    if utilisateur.role == UtilisateurRole.PROPRIETAIRE:
        subscription_service.create_trial_subscription(db, owner_id=utilisateur.id, target_type=SubscriptionTarget.PROPRIETAIRE)
    elif utilisateur.role == UtilisateurRole.GESTIONNAIRE:
        agence = Agence(nom=utilisateur_in.agence_nom.strip())
        db.add(agence)
        db.commit()
        db.refresh(agence)

        db.add(
            AgenceMembre(
                agence_id=agence.id,
                utilisateur_id=utilisateur.id,
                role_agence=RoleAgence.ADMIN,
                statut=AgenceMembreStatus.ACTIF,
                date_debut=datetime.utcnow().date(),
            )
        )
        db.commit()
        
        # Le premier membre de l'agence (ADMIN) reçoit l'abonnement d'essai pour l'agence.
        subscription_service.create_trial_subscription(db, agence_id=agence.id, target_type=SubscriptionTarget.AGENCE)

    return utilisateur


def login(db: Session, email: str, password: str) -> Token:
    utilisateur = db.query(Utilisateur).filter(Utilisateur.email == email).first()
    if not utilisateur or not verify_password(password, utilisateur.mot_de_passe):
        raise Forbidden("Incorrect email or password")
    if utilisateur.statut_compte != StatutCompte.ACTIF:
        raise Forbidden("Account is not active")
    if utilisateur.role == UtilisateurRole.GESTIONNAIRE and active_agence_id(db, utilisateur.id) is None:
        # Un gestionnaire révoqué de son agence (voir agence_service.remove_agence_member)
        # n'a plus rien à faire dans l'app tant qu'il n'est pas réinvité ailleurs —
        # même garde-fou que get_current_user, ici pour rejeter dès la connexion
        # plutôt que de délivrer un token qui échouera à la toute première requête.
        raise Forbidden("Your access to this agence has been revoked")

    utilisateur.derniere_connexion = datetime.utcnow()
    db.commit()

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
