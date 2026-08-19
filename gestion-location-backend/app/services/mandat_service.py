from datetime import datetime

from sqlalchemy.orm import Session

from app.api.deps import active_agence_id
from app.models.agence import Agence
from app.models.bien import Bien
from app.models.manager_permission import ManagerPermission
from app.models.mandat import Mandat, MandatStatus
from app.models.permission import Permission
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.manager_permission import ManagerPermissionsUpdate
from app.schemas.mandat import MandatCreate, MandatUpdate
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.usage_service import enforce_limit

# Accordées automatiquement à la création d'un mandat : la lecture "vient avec le
# mandat" par défaut (comportement historique), mais reste un vrai droit que le
# propriétaire peut ensuite révoquer depuis la page Permissions.
DEFAULT_VIEW_PERMISSIONS = ["VIEW_PROPERTY", "VIEW_LOT", "VIEW_LEASE", "VIEW_DUE_DATE", "VIEW_PAYMENT", "VIEW_CHARGE"]

# Reflète la hiérarchie réelle des données (un bien contient des lots, qui
# contiennent des baux, qui ont des échéances, qui ont des paiements) : voir un
# niveau nécessite de voir tous les niveaux au-dessus dans cette liste.
RESOURCE_HIERARCHY = ["PROPERTY", "LOT", "LEASE", "DUE_DATE", "PAYMENT"]


def _can_view_mandat(db: Session, current_user: Utilisateur, mandat: Mandat) -> bool:
    return (
        current_user.role == UtilisateurRole.ADMINISTRATEUR
        or current_user.id == mandat.proprietaire_id
        or active_agence_id(db, current_user.id) == mandat.agence_id
    )


def list_mandats(db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100) -> list[Mandat]:
    query = db.query(Mandat).filter(Mandat.deleted_at.is_(None))
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = query.filter(Mandat.proprietaire_id == current_user.id)
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        agence_id = active_agence_id(db, current_user.id)
        if agence_id is None:
            return []
        query = query.filter(Mandat.agence_id == agence_id)
    elif current_user.role != UtilisateurRole.ADMINISTRATEUR:
        return []
    return query.offset(skip).limit(limit).all()


def get_mandat(db: Session, current_user: Utilisateur, mandat_id: int) -> Mandat:
    mandat = (
        db.query(Mandat)
        .filter(Mandat.id == mandat_id, Mandat.deleted_at.is_(None))
        .first()
    )
    if not mandat:
        raise NotFound("Mandate not found")
    if not _can_view_mandat(db, current_user, mandat):
        raise Forbidden("Not allowed to access this mandate")
    return mandat


def create_mandat(db: Session, current_user: Utilisateur, mandat_in: MandatCreate) -> Mandat:
    if (
        current_user.role == UtilisateurRole.PROPRIETAIRE
        and current_user.id != mandat_in.proprietaire_id
    ):
        raise Forbidden("A proprietaire can only create a mandate for themself")

    agence = db.get(Agence, mandat_in.agence_id)
    proprietaire = db.get(Utilisateur, mandat_in.proprietaire_id)
    if not agence or agence.deleted_at is not None:
        raise BadRequest("agence_id must reference an agence")
    if not proprietaire or proprietaire.role != UtilisateurRole.PROPRIETAIRE:
        raise BadRequest("proprietaire_id must reference a proprietaire")

    if (
        current_user.role == UtilisateurRole.GESTIONNAIRE
        and active_agence_id(db, current_user.id) != mandat_in.agence_id
    ):
        raise Forbidden("A gestionnaire can only create a mandate for their own agence")

    if mandat_in.bien_id is not None:
        bien = (
            db.query(Bien)
            .filter(Bien.id == mandat_in.bien_id, Bien.deleted_at.is_(None))
            .first()
        )
        if not bien or bien.proprietaire_id != mandat_in.proprietaire_id:
            raise BadRequest("bien_id must reference a property owned by this proprietaire")

    duplicate = (
        db.query(Mandat)
        .filter(
            Mandat.agence_id == mandat_in.agence_id,
            Mandat.proprietaire_id == mandat_in.proprietaire_id,
            Mandat.bien_id == mandat_in.bien_id,
            Mandat.statut == MandatStatus.ACTIF,
            Mandat.deleted_at.is_(None),
        )
        .first()
    )
    if duplicate:
        raise BadRequest("An active mandate already exists for this agence on this scope")

    if mandat_in.statut == MandatStatus.ACTIF:
        enforce_limit(db, mandat_in.proprietaire_id, "gestionnaires")

    mandat = Mandat(**mandat_in.model_dump(), created_by=current_user.id)
    db.add(mandat)
    db.commit()
    db.refresh(mandat)

    default_permissions = db.query(Permission).filter(Permission.code.in_(DEFAULT_VIEW_PERMISSIONS)).all()
    db.add_all([ManagerPermission(mandat_id=mandat.id, permission_id=p.id) for p in default_permissions])
    db.commit()

    return mandat


def update_mandat(db: Session, current_user: Utilisateur, mandat_id: int, mandat_in: MandatUpdate) -> Mandat:
    mandat = (
        db.query(Mandat)
        .filter(Mandat.id == mandat_id, Mandat.deleted_at.is_(None))
        .first()
    )
    if not mandat:
        raise NotFound("Mandate not found")
    if not _can_view_mandat(db, current_user, mandat):
        raise Forbidden("Not allowed to modify this mandate")

    update_data = mandat_in.model_dump(exclude_unset=True)
    prospective_statut = update_data.get("statut", mandat.statut)
    if prospective_statut == MandatStatus.ACTIF and mandat.statut != MandatStatus.ACTIF:
        # Réactiver un mandat révoqué remet un gestionnaire actif dans le quota du
        # plan, exactement comme en créer un nouveau (voir create_mandat) — même
        # garde-fou qu'un bail qu'on repasse à ACTIF (bail_service.update_bail).
        enforce_limit(db, mandat.proprietaire_id, "gestionnaires")

    for field, value in update_data.items():
        setattr(mandat, field, value)
    db.commit()
    db.refresh(mandat)
    return mandat


def delete_mandat(db: Session, current_user: Utilisateur, mandat_id: int) -> None:
    mandat = (
        db.query(Mandat)
        .filter(Mandat.id == mandat_id, Mandat.deleted_at.is_(None))
        .first()
    )
    if not mandat:
        raise NotFound("Mandate not found")
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != mandat.proprietaire_id:
        raise Forbidden("Not allowed to delete this mandate")
    mandat.deleted_at = datetime.utcnow()
    db.commit()


def list_mandat_permissions(db: Session, current_user: Utilisateur, mandat_id: int) -> list[ManagerPermission]:
    mandat = (
        db.query(Mandat)
        .filter(Mandat.id == mandat_id, Mandat.deleted_at.is_(None))
        .first()
    )
    if not mandat:
        raise NotFound("Mandate not found")
    if not _can_view_mandat(db, current_user, mandat):
        raise Forbidden("Not allowed to access this mandate")
    return db.query(ManagerPermission).filter(ManagerPermission.mandat_id == mandat_id).all()


def set_mandat_permissions(
    db: Session,
    current_user: Utilisateur,
    mandat_id: int,
    permissions_in: ManagerPermissionsUpdate,
) -> list[ManagerPermission]:
    """Fully replaces the permissions granted on this mandate.
    Reserved for the proprietaire concerned (or an admin): a gestionnaire can never
    grant themselves permissions."""
    mandat = (
        db.query(Mandat)
        .filter(Mandat.id == mandat_id, Mandat.deleted_at.is_(None))
        .first()
    )
    if not mandat:
        raise NotFound("Mandate not found")
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != mandat.proprietaire_id:
        raise Forbidden("Not allowed to manage this mandate's permissions")

    codes = set(permissions_in.permissions)
    permissions = db.query(Permission).filter(Permission.code.in_(codes)).all() if codes else []
    found_codes = {p.code for p in permissions}
    unknown_codes = codes - found_codes
    if unknown_codes:
        raise BadRequest(f"Unknown permission code(s): {sorted(unknown_codes)}")

    # Deux garde-fous (en plus du même comportement déjà appliqué côté interface) :
    # 1. L'écriture sans lecture n'a pas de sens : pas de CREATE/UPDATE/DELETE_X
    #    sans VIEW_X pour cette même ressource.
    # 2. La hiérarchie des données (un bien contient des lots, qui contiennent des
    #    baux, qui ont des échéances, qui ont des paiements) doit se refléter dans
    #    les droits : impossible de voir/gérer des lots si on n'a pas VIEW_PROPERTY,
    #    des baux sans VIEW_LOT, etc.
    def _resource_of(code: str) -> str:
        return code.split("_", 1)[1]

    viewable_resources = {_resource_of(c) for c in found_codes if c.startswith("VIEW_")}

    def _is_blocked(resource: str) -> bool:
        if resource not in RESOURCE_HIERARCHY:
            return False
        ancestors = RESOURCE_HIERARCHY[: RESOURCE_HIERARCHY.index(resource)]
        return any(ancestor not in viewable_resources for ancestor in ancestors)

    permissions = [
        p
        for p in permissions
        if not _is_blocked(_resource_of(p.code))
        and (p.code.startswith("VIEW_") or _resource_of(p.code) in viewable_resources)
    ]

    db.query(ManagerPermission).filter(ManagerPermission.mandat_id == mandat_id).delete()
    db.add_all([ManagerPermission(mandat_id=mandat_id, permission_id=p.id) for p in permissions])
    db.commit()

    return db.query(ManagerPermission).filter(ManagerPermission.mandat_id == mandat_id).all()
