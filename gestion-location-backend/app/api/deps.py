from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.bien import Bien
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


def gestionnaire_ids_for_proprietaire(db: Session, proprietaire_id: int) -> list[int]:
    """Ids of gestionnaires who have an active Mandat with this proprietaire —
    symmetric counterpart of managed_proprietaire_ids, used to fan out
    notifications (paiement/échéance/relance) to whoever manages the property."""
    rows = (
        db.query(Mandat.gestionnaire_id)
        .filter(Mandat.proprietaire_id == proprietaire_id, Mandat.statut == MandatStatus.ACTIF)
        .all()
    )
    return [row[0] for row in rows]


def proprietaire_ids_with_permission(db: Session, gestionnaire_id: int, code: str) -> list[int]:
    """Ids of proprietaires for whom this gestionnaire holds an active, PORTFOLIO-WIDE
    Mandat (bien_id IS NULL) granting this code. A mandate scoped to a single bien does
    NOT count here — it grants no authority over the rest of that proprietaire's
    portfolio. Used for actions that aren't tied to an existing bien (e.g. creating a
    brand new property)."""
    rows = (
        db.query(Mandat.proprietaire_id)
        .join(ManagerPermission, ManagerPermission.mandat_id == Mandat.id)
        .join(Permission, Permission.id == ManagerPermission.permission_id)
        .filter(
            Mandat.gestionnaire_id == gestionnaire_id,
            Mandat.statut == MandatStatus.ACTIF,
            Mandat.bien_id.is_(None),
            Permission.code == code,
        )
        .distinct()
        .all()
    )
    return [row[0] for row in rows]


def has_permission(db: Session, user: Utilisateur, proprietaire_id: int, code: str) -> bool:
    """Portfolio-wide check: true for an admin, the proprietaire themself, or a
    gestionnaire whose active, portfolio-wide Mandat was granted this code. Use
    has_permission_for_bien for anything scoped to one existing bien."""
    if user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    if user.role == UtilisateurRole.PROPRIETAIRE:
        return user.id == proprietaire_id
    if user.role == UtilisateurRole.GESTIONNAIRE:
        return proprietaire_id in proprietaire_ids_with_permission(db, user.id, code)
    return False


def bien_ids_with_permission(db: Session, gestionnaire_id: int, code: str) -> list[int]:
    """Ids of biens this gestionnaire can act on with this permission — via a
    portfolio-wide Mandat (covers every bien of that proprietaire) or a Mandat
    scoped to that one bien specifically."""
    rows = (
        db.query(Mandat.bien_id, Mandat.proprietaire_id)
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
    bien_ids = set()
    blanket_proprietaire_ids = set()
    for bien_id, proprietaire_id in rows:
        if bien_id is None:
            blanket_proprietaire_ids.add(proprietaire_id)
        else:
            bien_ids.add(bien_id)
    if blanket_proprietaire_ids:
        extra = (
            db.query(Bien.id)
            .filter(Bien.proprietaire_id.in_(blanket_proprietaire_ids), Bien.deleted_at.is_(None))
            .all()
        )
        bien_ids.update(row[0] for row in extra)
    return list(bien_ids)


def has_permission_for_bien(db: Session, user: Utilisateur, bien: Bien, code: str) -> bool:
    """Read/write access to one specific, already-existing bien: an admin, the
    proprietaire themself, or a gestionnaire whose active Mandat (portfolio-wide or
    scoped to this exact bien) was granted this code."""
    if user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    if user.role == UtilisateurRole.PROPRIETAIRE:
        return user.id == bien.proprietaire_id
    if user.role == UtilisateurRole.GESTIONNAIRE:
        return bien.id in bien_ids_with_permission(db, user.id, code)
    return False
