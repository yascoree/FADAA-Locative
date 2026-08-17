from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import bien_ids_with_permission, gestionnaire_ids_for_proprietaire, managed_proprietaire_ids
from app.core.security import hash_password
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.lot import Lot
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurUpdate
from app.services import utilisateur_service
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.usage_service import enforce_limit


def _is_my_tenant(db: Session, current_user: Utilisateur, tenant_id: int) -> bool:
    if current_user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        proprietaire_ids = [current_user.id]
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        proprietaire_ids = managed_proprietaire_ids(db, current_user.id)
        if not proprietaire_ids:
            return False
    else:
        return False

    return (
        db.query(Bail)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(Bail.locataire_id == tenant_id, Bien.proprietaire_id.in_(proprietaire_ids))
        .first()
        is not None
    )


def list_locataires(db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 1000) -> list[Utilisateur]:
    query = db.query(Utilisateur).filter(
        Utilisateur.role == UtilisateurRole.LOCATAIRE,
        Utilisateur.deleted_at.is_(None),
    )
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        tenant_ids_with_bail = (
            db.query(Bail.locataire_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id == current_user.id)
        )
        # A tenant a gestionnaire onboarded on this propriétaire's behalf must be
        # just as visible to the propriétaire as one they created themselves —
        # otherwise a brand-new (bail-less) tenant is invisible to one side of
        # the relationship until a bail happens to already link them.
        creator_ids = [current_user.id, *gestionnaire_ids_for_proprietaire(db, current_user.id)]
        query = query.filter(
            or_(Utilisateur.id.in_(tenant_ids_with_bail), Utilisateur.cree_par_id.in_(creator_ids))
        )
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = managed_proprietaire_ids(db, current_user.id)
        tenant_ids_with_bail = (
            db.query(Bail.locataire_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id.in_(ids))
            if ids
            else db.query(Bail.locataire_id).filter(False)
        )
        creator_ids = [current_user.id, *ids]
        query = query.filter(
            or_(Utilisateur.id.in_(tenant_ids_with_bail), Utilisateur.cree_par_id.in_(creator_ids))
        )
    elif current_user.role != UtilisateurRole.ADMINISTRATEUR:
        return []
    return query.offset(skip).limit(limit).all()


def get_locataire(db: Session, current_user: Utilisateur, locataire_id: int) -> Utilisateur:
    locataire = db.get(Utilisateur, locataire_id)
    if not locataire or locataire.role != UtilisateurRole.LOCATAIRE:
        raise NotFound("Tenant not found")
    is_self = current_user.id == locataire_id
    if not is_self and not _is_my_tenant(db, current_user, locataire_id):
        raise Forbidden("Not allowed to access this tenant")
    return locataire


def create_locataire(db: Session, current_user: Utilisateur, locataire_in: UtilisateurCreate) -> Utilisateur:
    """Allows a proprietaire/gestionnaire to onboard a tenant without going through an admin."""
    existing = db.query(Utilisateur).filter(Utilisateur.email == locataire_in.email).first()
    if existing:
        raise BadRequest("Email already registered")

    # Le quota "locataires" du plan ne compte normalement que les locataires liés
    # à un bail actif (voir usage_service.compute_owner_usage), mais un abonnement
    # expiré/suspendu doit bloquer TOUTE création — y compris un compte locataire
    # pas encore rattaché à un bail — pas seulement le dépassement de quota.
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        enforce_limit(db, current_user.id, "locataires")

    locataire = Utilisateur(
        nom=locataire_in.nom,
        prenom=locataire_in.prenom,
        email=locataire_in.email,
        mot_de_passe=hash_password(locataire_in.mot_de_passe),
        role=UtilisateurRole.LOCATAIRE,
        statut_compte=locataire_in.statut_compte,
        cree_par_id=current_user.id,
    )
    db.add(locataire)
    db.commit()
    db.refresh(locataire)
    return locataire


def update_locataire(
    db: Session, current_user: Utilisateur, locataire_id: int, locataire_in: UtilisateurUpdate
) -> Utilisateur:
    # Account data (email, password, role…) remains managed by the tenant themselves or
    # an admin, even though a proprietaire/gestionnaire can create and view them.
    is_admin = current_user.role == UtilisateurRole.ADMINISTRATEUR
    if not is_admin and current_user.id != locataire_id:
        raise Forbidden("Insufficient permissions")

    locataire = db.get(Utilisateur, locataire_id)
    if not locataire or locataire.role != UtilisateurRole.LOCATAIRE:
        raise NotFound("Tenant not found")

    update_data = locataire_in.model_dump(exclude_unset=True, exclude={"mot_de_passe"})
    if not is_admin:
        update_data.pop("role", None)
        update_data.pop("statut_compte", None)

    for field, value in update_data.items():
        setattr(locataire, field, value)

    if locataire_in.mot_de_passe:
        locataire.mot_de_passe = hash_password(locataire_in.mot_de_passe)

    db.commit()
    db.refresh(locataire)
    return locataire


def _can_manage_tenant_status(db: Session, current_user: Utilisateur, tenant_id: int) -> bool:
    """Qui peut activer/désactiver ce locataire — distinct de _is_my_tenant (lecture)
    car un gestionnaire y a en plus besoin du droit UPDATE_LEASE : la désactivation
    touche à la relation contractuelle, pas seulement à la consultation."""
    if current_user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        return _is_my_tenant(db, current_user, tenant_id)
    if current_user.role == UtilisateurRole.GESTIONNAIRE:
        allowed_bien_ids = bien_ids_with_permission(db, current_user.id, "UPDATE_LEASE")
        if not allowed_bien_ids:
            return False
        return (
            db.query(Bail)
            .join(Lot, Lot.id == Bail.lot_id)
            .filter(Bail.locataire_id == tenant_id, Lot.bien_id.in_(allowed_bien_ids))
            .first()
            is not None
        )
    return False


def _get_manageable_locataire(db: Session, current_user: Utilisateur, tenant_id: int) -> Utilisateur:
    locataire = db.get(Utilisateur, tenant_id)
    if not locataire or locataire.role != UtilisateurRole.LOCATAIRE:
        raise NotFound("Tenant not found")
    if not _can_manage_tenant_status(db, current_user, tenant_id):
        raise Forbidden("Not allowed to manage this tenant")
    return locataire


def deactivate_locataire(db: Session, current_user: Utilisateur, tenant_id: int) -> Utilisateur:
    _get_manageable_locataire(db, current_user, tenant_id)
    return utilisateur_service.deactivate_utilisateur(db, current_user, tenant_id)


def activate_locataire(db: Session, current_user: Utilisateur, tenant_id: int) -> Utilisateur:
    _get_manageable_locataire(db, current_user, tenant_id)
    return utilisateur_service.activate_utilisateur(db, tenant_id)
