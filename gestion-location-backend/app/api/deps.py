from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.mandat import Mandat, MandatStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Utilisateur:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.get(Utilisateur, int(user_id))
    if user is None:
        raise credentials_exception
    return user


def require_roles(*roles: UtilisateurRole):
    """Dependency factory restricting an endpoint to the given roles."""

    def checker(current_user: Utilisateur = Depends(get_current_user)) -> Utilisateur:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return checker


require_admin = require_roles(UtilisateurRole.ADMINISTRATEUR)

# Roles allowed to manage rental assets (biens/lots/baux/...).
require_gestion = require_roles(
    UtilisateurRole.ADMINISTRATEUR, UtilisateurRole.PROPRIETAIRE, UtilisateurRole.GESTIONNAIRE
)


def managed_proprietaire_ids(db: Session, gestionnaire_id: int) -> list[int]:
    """Ids of proprietaires who have an active Mandat with this gestionnaire."""
    rows = (
        db.query(Mandat.proprietaire_id)
        .filter(Mandat.gestionnaire_id == gestionnaire_id, Mandat.statut == MandatStatus.ACTIF)
        .all()
    )
    return [row[0] for row in rows]


def can_manage_proprietaire(db: Session, user: Utilisateur, proprietaire_id: int) -> bool:
    """True for an admin, the proprietaire themself, or a gestionnaire mandated by that proprietaire."""
    if user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    if user.role == UtilisateurRole.PROPRIETAIRE:
        return user.id == proprietaire_id
    if user.role == UtilisateurRole.GESTIONNAIRE:
        return proprietaire_id in managed_proprietaire_ids(db, user.id)
    return False
