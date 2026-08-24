from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.agence_membre import AgenceMembre, AgenceMembreStatus
from app.models.bien import Bien
from app.models.manager_permission import ManagerPermission
from app.models.mandat import Mandat, MandatStatus
from app.models.permission import Permission
from app.models.utilisateur import StatutCompte, Utilisateur, UtilisateurRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def _is_revoked_gestionnaire(db: Session, user: Utilisateur) -> bool:
    """A Gestionnaire's access is entirely derived from their agence membership
    (see active_agence_id) — they have nothing to do in the app once revoked from
    it. Since JWTs here are stateless (no blacklist table), this per-request DB
    check is what actually cuts off access on revocation: an access token issued
    before the revocation stays cryptographically valid until it expires, but
    every request re-resolves membership from the database, so the very next
    request after a revocation is rejected regardless of the token's own validity."""
    return user.role == UtilisateurRole.GESTIONNAIRE and active_agence_id(db, user.id) is None


def get_optional_user(
    token: str | None = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)
) -> Utilisateur | None:
    """Like get_current_user, but returns None instead of raising when there's no
    (or an invalid) token — for endpoints reachable by anonymous visitors (e.g. the
    public landing page) that also behave differently for a logged-in user."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    user = db.get(Utilisateur, int(user_id))
    if user is None or user.statut_compte != StatutCompte.ACTIF:
        return None
    if _is_revoked_gestionnaire(db, user):
        return None
    return user


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
    if _is_revoked_gestionnaire(db, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your access to this agence has been revoked")
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


def active_agence_id(db: Session, utilisateur_id: int) -> int | None:
    """The agence this user currently belongs to (at most one ACTIF membership in
    V1 — see AgenceMembre), or None if they aren't agence staff. This is the single
    resolution point every gestionnaire-scoped permission check below goes
    through: access flows from agence membership, never from a specific user id on
    Mandat, so a mandate stays valid for the whole team regardless of who created
    it or who has since left."""
    row = (
        db.query(AgenceMembre.agence_id)
        .filter(AgenceMembre.utilisateur_id == utilisateur_id, AgenceMembre.statut == AgenceMembreStatus.ACTIF)
        .first()
    )
    return row[0] if row else None


def managed_proprietaire_ids(db: Session, gestionnaire_id: int) -> list[int]:
    """Ids of proprietaires who have an active Mandat with this gestionnaire's
    agence, regardless of which specific permissions were granted."""
    agence_id = active_agence_id(db, gestionnaire_id)
    if agence_id is None:
        return []
    rows = (
        db.query(Mandat.proprietaire_id)
        .filter(Mandat.agence_id == agence_id, Mandat.statut == MandatStatus.ACTIF)
        .distinct()
        .all()
    )
    return [row[0] for row in rows]


def can_access_proprietaire(db: Session, user: Utilisateur, proprietaire_id: int) -> bool:
    """Whether `user` is allowed to access data scoped to this proprietaire id.

    This is a scope check helper (portfolio membership), not a permission code
    check: per-resource permissions must still be enforced separately.
    """
    if user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    if user.role == UtilisateurRole.PROPRIETAIRE:
        return user.id == proprietaire_id
    if user.role == UtilisateurRole.GESTIONNAIRE:
        return proprietaire_id in managed_proprietaire_ids(db, user.id)
    return False


def gestionnaire_ids_for_proprietaire(db: Session, proprietaire_id: int) -> list[int]:
    """Ids of gestionnaires who should be treated as acting for this proprietaire —
    every ACTIF member of every agence that holds an active Mandat with them (not
    just whoever created the mandate). Used to fan out notifications (paiement/
    échéance/relance) to the whole team managing the property."""
    agence_ids = (
        db.query(Mandat.agence_id)
        .filter(Mandat.proprietaire_id == proprietaire_id, Mandat.statut == MandatStatus.ACTIF)
        .distinct()
        .all()
    )
    agence_ids = [row[0] for row in agence_ids]
    if not agence_ids:
        return []
    rows = (
        db.query(AgenceMembre.utilisateur_id)
        .filter(AgenceMembre.agence_id.in_(agence_ids), AgenceMembre.statut == AgenceMembreStatus.ACTIF)
        .distinct()
        .all()
    )
    return [row[0] for row in rows]


def proprietaire_ids_with_permission(db: Session, gestionnaire_id: int, code: str) -> list[int]:
    """Ids of proprietaires for whom this gestionnaire's agence holds an active,
    PORTFOLIO-WIDE Mandat (bien_id IS NULL) granting this code. A mandate scoped to
    a single bien does NOT count here — it grants no authority over the rest of
    that proprietaire's portfolio. Used for actions that aren't tied to an existing
    bien (e.g. creating a brand new property)."""
    agence_id = active_agence_id(db, gestionnaire_id)
    if agence_id is None:
        return []
    rows = (
        db.query(Mandat.proprietaire_id)
        .join(ManagerPermission, ManagerPermission.mandat_id == Mandat.id)
        .join(Permission, Permission.id == ManagerPermission.permission_id)
        .filter(
            Mandat.agence_id == agence_id,
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
    gestionnaire whose agence's active, portfolio-wide Mandat was granted this
    code. Use has_permission_for_bien for anything scoped to one existing bien."""
    if user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    if user.role == UtilisateurRole.PROPRIETAIRE:
        return user.id == proprietaire_id
    if user.role == UtilisateurRole.GESTIONNAIRE:
        return proprietaire_id in proprietaire_ids_with_permission(db, user.id, code)
    return False


def bien_ids_with_permission(db: Session, gestionnaire_id: int, code: str) -> list[int]:
    """Ids of biens this gestionnaire's agence can act on with this permission.

    A Mandat scoped to one specific bien is authoritative for that bien and
    overrides any portfolio-wide Mandat the same agence also holds for that
    proprietaire — otherwise revoking a permission on the bien-specific Mandat
    would have no effect as long as the blanket Mandat still grants it. A
    portfolio-wide Mandat only fills in the biens that have no bien-specific
    Mandat of their own."""
    agence_id = active_agence_id(db, gestionnaire_id)
    if agence_id is None:
        return []
    mandats = (
        db.query(Mandat.id, Mandat.bien_id, Mandat.proprietaire_id)
        .filter(Mandat.agence_id == agence_id, Mandat.statut == MandatStatus.ACTIF)
        .all()
    )
    if not mandats:
        return []

    mandat_ids = [m.id for m in mandats]
    granted_mandat_ids = {
        row[0]
        for row in (
            db.query(Mandat.id)
            .join(ManagerPermission, ManagerPermission.mandat_id == Mandat.id)
            .join(Permission, Permission.id == ManagerPermission.permission_id)
            .filter(Mandat.id.in_(mandat_ids), Permission.code == code)
            .all()
        )
    }

    overridden_bien_ids = {m.bien_id for m in mandats if m.bien_id is not None}
    blanket_proprietaire_ids = {m.proprietaire_id for m in mandats if m.bien_id is None and m.id in granted_mandat_ids}

    bien_ids = {m.bien_id for m in mandats if m.bien_id is not None and m.id in granted_mandat_ids}
    if blanket_proprietaire_ids:
        extra = (
            db.query(Bien.id)
            .filter(Bien.proprietaire_id.in_(blanket_proprietaire_ids), Bien.deleted_at.is_(None))
            .all()
        )
        bien_ids.update(row[0] for row in extra if row[0] not in overridden_bien_ids)
    return list(bien_ids)


def has_permission_for_bien(db: Session, user: Utilisateur, bien: Bien, code: str) -> bool:
    """Read/write access to one specific, already-existing bien: an admin, the
    proprietaire themself, or a gestionnaire whose agence's active Mandat
    (portfolio-wide or scoped to this exact bien) was granted this code."""
    if user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    if user.role == UtilisateurRole.PROPRIETAIRE:
        return user.id == bien.proprietaire_id
    if user.role == UtilisateurRole.GESTIONNAIRE:
        return bien.id in bien_ids_with_permission(db, user.id, code)
    return False
