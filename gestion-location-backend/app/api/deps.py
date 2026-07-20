from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.manager_permission import ManagerPermission
from app.models.mandat import Mandat, MandatStatus
from app.models.permission import Permission
from app.models.utilisateur import StatutCompte, Utilisateur, UtilisateurRole

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
    if user.statut_compte != StatutCompte.ACTIF:
        # Revérifié à chaque requête (le JWT est sans état) : désactiver un compte
        # coupe l'accès immédiatement, même pour un token déjà émis.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
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
    """Ids of proprietaires who have an active Mandat with this gestionnaire,
    regardless of which specific permissions were granted."""
    rows = (
        db.query(Mandat.proprietaire_id)
        .filter(Mandat.gestionnaire_id == gestionnaire_id, Mandat.statut == MandatStatus.ACTIF)
        .all()
    )
    return [row[0] for row in rows]


def can_view_proprietaire(db: Session, user: Utilisateur, proprietaire_id: int) -> bool:
    """Read access: admin, the proprietaire themself, or any gestionnaire with an
    active Mandat with that proprietaire. Unlike write actions, viewing is never
    gated behind an individual permission grant — it comes with the mandate."""
    if user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    if user.role == UtilisateurRole.PROPRIETAIRE:
        return user.id == proprietaire_id
    if user.role == UtilisateurRole.GESTIONNAIRE:
        return proprietaire_id in managed_proprietaire_ids(db, user.id)
    return False


def proprietaire_ids_with_permission(db: Session, gestionnaire_id: int, code: str) -> list[int]:
    """Ids of proprietaires for whom this gestionnaire holds an active Mandat that
    was granted the given permission code (see app.models.permission)."""
    rows = (
        db.query(Mandat.proprietaire_id)
        .join(ManagerPermission, ManagerPermission.mandat_id == Mandat.id)
        .join(Permission, Permission.id == ManagerPermission.permission_id)
        .filter(
            Mandat.gestionnaire_id == gestionnaire_id,
            Mandat.statut == MandatStatus.ACTIF,
            Permission.code == code,
        )
        .distinct()
        .all()
    )
    return [row[0] for row in rows]


def has_permission(db: Session, user: Utilisateur, proprietaire_id: int, code: str) -> bool:
    """True for an admin, the proprietaire themself, or a gestionnaire whose active
    Mandat with that proprietaire was explicitly granted this permission code."""
    if user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    if user.role == UtilisateurRole.PROPRIETAIRE:
        return user.id == proprietaire_id
    if user.role == UtilisateurRole.GESTIONNAIRE:
        return proprietaire_id in proprietaire_ids_with_permission(db, user.id, code)
    return False
