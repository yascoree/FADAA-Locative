import secrets
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_password_reset_token, hash_password
from app.models.agence import Agence
from app.models.agence_membre import AgenceMembre, AgenceMembreStatus, RoleAgence
from app.models.mandat import Mandat, MandatStatus
from app.models.utilisateur import StatutCompte, Utilisateur, UtilisateurRole
from app.schemas.gestionnaire_invite import GestionnaireInviteCreate
from app.schemas.mandat import MandatCreate
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurUpdate
from app.services import mandat_service, subscription_service
from app.services.email_service import send_email
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.usage_service import enforce_limit

LOOKUP_ROLES = {
    "GESTIONNAIRE": UtilisateurRole.GESTIONNAIRE,
    "LOCATAIRE": UtilisateurRole.LOCATAIRE,
}


def list_utilisateurs(db: Session, skip: int = 0, limit: int = 100) -> list[Utilisateur]:
    return (
        db.query(Utilisateur)
        .filter(Utilisateur.deleted_at.is_(None))
        .offset(skip)
        .limit(limit)
        .all()
    )


def list_gestionnaires(db: Session, skip: int = 0, limit: int = 100) -> list[Utilisateur]:
    return (
        db.query(Utilisateur)
        .filter(Utilisateur.deleted_at.is_(None), Utilisateur.role == UtilisateurRole.GESTIONNAIRE)
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_gestionnaire_invite(
    db: Session, proprietaire: Utilisateur, payload: GestionnaireInviteCreate
) -> tuple[Utilisateur, Mandat, Optional[str]]:
    """Proprietaire-only: invites a Gestionnaire who doesn't already have an
    account (a Gestionnaire can also self-register directly, see
    auth_service.PUBLIC_REGISTER_ROLES) — created by the proprietaire they'll work
    for, with access granted in the same step. The account starts
    INVITE_EN_ATTENTE with a random, unusable password; a set-password email
    (reset-password flow) is sent, or its link is returned directly in test mode
    (see email_service.send_email).

    A Mandat belongs to an Agence, not to an individual user (see app.models.mandat)
    — so this also creates a single-member Agence for the new gestionnaire, who
    becomes its ADMIN and can later grow it via agence_service.invite_agence_member."""
    existing = db.query(Utilisateur).filter(Utilisateur.email == payload.email).first()
    if existing:
        raise BadRequest("Email already registered")

    # Vérifié avant toute création pour ne jamais laisser un compte utilisateur
    # orphelin (sans mandat) si la limite du plan est atteinte.
    enforce_limit(db, proprietaire.id, "gestionnaires")

    utilisateur = Utilisateur(
        nom=payload.nom,
        prenom=payload.prenom,
        email=payload.email,
        mot_de_passe=hash_password(secrets.token_urlsafe(24)),
        role=UtilisateurRole.GESTIONNAIRE,
        statut_compte=StatutCompte.INVITE_EN_ATTENTE,
        cree_par_id=proprietaire.id,
    )
    db.add(utilisateur)
    db.commit()
    db.refresh(utilisateur)

    agence = Agence(nom=f"{payload.prenom} {payload.nom}")
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

    mandat = mandat_service.create_mandat(
        db,
        proprietaire,
        MandatCreate(
            agence_id=agence.id,
            proprietaire_id=proprietaire.id,
            bien_id=payload.bien_id,
            statut=MandatStatus.ACTIF,
            date_debut=datetime.utcnow().date(),
        ),
    )

    token = create_password_reset_token(utilisateur.id, utilisateur.mot_de_passe)
    invite_link = f"{settings.frontend_base_url}/front/reset-password?token={token}"
    html_body = f"""
    <p>Bonjour {utilisateur.prenom},</p>
    <p>{proprietaire.prenom} {proprietaire.nom} vous a créé un accès gestionnaire sur
    FADAA Locative.</p>
    <p>Choisissez votre mot de passe pour activer votre compte (lien valable
    {settings.password_reset_token_expire_minutes} minutes) :</p>
    <p><a href="{invite_link}">{invite_link}</a></p>
    """
    sent = send_email(utilisateur.email, "Votre accès gestionnaire — FADAA Locative", html_body)

    return utilisateur, mandat, (None if sent else invite_link)


def get_utilisateur(db: Session, current_user: Utilisateur, utilisateur_id: int) -> Utilisateur:
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != utilisateur_id:
        raise Forbidden("Insufficient permissions")
    utilisateur = (
        db.query(Utilisateur)
        .filter(Utilisateur.id == utilisateur_id, Utilisateur.deleted_at.is_(None))
        .first()
    )
    if not utilisateur:
        raise NotFound("User not found")
    return utilisateur


def create_utilisateur(db: Session, utilisateur_in: UtilisateurCreate) -> Utilisateur:
    """Admin-only: direct creation of an account with a given role.
    Public registration goes through /auth/register (always Propriétaire)."""
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

    if utilisateur.role == UtilisateurRole.PROPRIETAIRE:
        subscription_service.create_trial_subscription(db, utilisateur.id)

    return utilisateur


def lookup_utilisateur_by_email(db: Session, email: str, role: str) -> Utilisateur:
    """Find a GESTIONNAIRE or LOCATAIRE by e-mail without exposing the full user directory."""
    target_role = LOOKUP_ROLES.get(role.upper())
    if target_role is None:
        raise BadRequest("role must be GESTIONNAIRE or LOCATAIRE")
    utilisateur = db.query(Utilisateur).filter(Utilisateur.email == email).first()
    if not utilisateur or utilisateur.role != target_role:
        raise NotFound(f"No {role.lower()} found with this email")
    return utilisateur


def update_utilisateur(
    db: Session, current_user: Utilisateur, utilisateur_id: int, utilisateur_in: UtilisateurUpdate
) -> Utilisateur:
    is_admin = current_user.role == UtilisateurRole.ADMINISTRATEUR
    if not is_admin and current_user.id != utilisateur_id:
        raise Forbidden("Insufficient permissions")

    utilisateur = (
        db.query(Utilisateur)
        .filter(Utilisateur.id == utilisateur_id, Utilisateur.deleted_at.is_(None))
        .first()
    )
    if not utilisateur:
        raise NotFound("User not found")

    update_data = utilisateur_in.model_dump(exclude_unset=True, exclude={"mot_de_passe"})
    if not is_admin:
        # A user cannot self-promote or change their account status.
        update_data.pop("role", None)
        update_data.pop("statut_compte", None)

    for field, value in update_data.items():
        setattr(utilisateur, field, value)

    if utilisateur_in.mot_de_passe:
        utilisateur.mot_de_passe = hash_password(utilisateur_in.mot_de_passe)

    db.commit()
    db.refresh(utilisateur)
    return utilisateur


def delete_utilisateur(db: Session, utilisateur_id: int) -> None:
    utilisateur = (
        db.query(Utilisateur)
        .filter(Utilisateur.id == utilisateur_id, Utilisateur.deleted_at.is_(None))
        .first()
    )
    if not utilisateur:
        raise NotFound("User not found")
    utilisateur.deleted_at = datetime.utcnow()
    db.commit()


def activate_utilisateur(db: Session, utilisateur_id: int) -> Utilisateur:
    utilisateur = (
        db.query(Utilisateur)
        .filter(Utilisateur.id == utilisateur_id, Utilisateur.deleted_at.is_(None))
        .first()
    )
    if not utilisateur:
        raise NotFound("User not found")
    utilisateur.statut_compte = StatutCompte.ACTIF
    db.commit()
    db.refresh(utilisateur)
    return utilisateur


def deactivate_utilisateur(db: Session, current_user: Utilisateur, utilisateur_id: int) -> Utilisateur:
    if utilisateur_id == current_user.id:
        raise BadRequest("Cannot deactivate your own account")
    utilisateur = (
        db.query(Utilisateur)
        .filter(Utilisateur.id == utilisateur_id, Utilisateur.deleted_at.is_(None))
        .first()
    )
    if not utilisateur:
        raise NotFound("User not found")
    # Reuse CREE_SANS_ACCES as the "deactivated" status: get_current_user() / login()
    # reject any account whose statut_compte != ACTIF, so this cuts access immediately,
    # even for already-issued tokens.
    utilisateur.statut_compte = StatutCompte.CREE_SANS_ACCES
    db.commit()
    db.refresh(utilisateur)
    return utilisateur
