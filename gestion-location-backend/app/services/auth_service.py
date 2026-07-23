from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.models.utilisateur import StatutCompte, Utilisateur, UtilisateurRole
from app.schemas.auth import Token
from app.schemas.utilisateur import UtilisateurCreate
from app.services import subscription_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

PUBLIC_REGISTER_ROLES = (UtilisateurRole.PROPRIETAIRE, UtilisateurRole.GESTIONNAIRE)


def register(db: Session, utilisateur_in: UtilisateurCreate) -> Utilisateur:
    """Public registration — Proprietaire or Gestionnaire only (never Admin/Locataire)."""
    if utilisateur_in.role not in PUBLIC_REGISTER_ROLES:
        raise BadRequest("role must be PROPRIETAIRE or GESTIONNAIRE")

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
