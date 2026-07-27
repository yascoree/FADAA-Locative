from datetime import datetime

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.utilisateur import StatutCompte, Utilisateur, UtilisateurRole
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurUpdate
from app.services import subscription_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

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


def deactivate_utilisateur(db: Session, admin: Utilisateur, utilisateur_id: int) -> Utilisateur:
    if utilisateur_id == admin.id:
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
