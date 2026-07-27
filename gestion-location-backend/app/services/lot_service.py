from datetime import datetime

from sqlalchemy.orm import Session

from app.api.deps import bien_ids_with_permission, has_permission_for_bien
from app.models.bail import Bail, BailStatus
from app.models.bien import Bien
from app.models.lot import Lot
from app.models.notification import NotificationType
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.lot import LotCreate, LotUpdate
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.push_service import send_push_to_user


def _notify_proprietaire_of_activity(
    db: Session, actor: Utilisateur, proprietaire_id: int, title: str, verbe: str, cible: str
) -> None:
    """Prévient le propriétaire quand un gestionnaire agit en son nom sur un lot."""
    if actor.role != UtilisateurRole.GESTIONNAIRE:
        return
    send_push_to_user(
        db,
        user_id=proprietaire_id,
        title=title,
        body=f"{actor.prenom} {actor.nom} (gestionnaire) {verbe} {cible}.",
        notif_type=NotificationType.GESTION,
    )


def _is_tenant_of_lot(db: Session, user_id: int, lot_id: int) -> bool:
    return (
        db.query(Bail)
        .filter(Bail.lot_id == lot_id, Bail.locataire_id == user_id)
        .first()
        is not None
    )


def _can_view_lot(db: Session, user: Utilisateur, lot: Lot) -> bool:
    bien = (
        db.query(Bien)
        .filter(Bien.id == lot.bien_id, Bien.deleted_at.is_(None))
        .first()
    )
    if bien and has_permission_for_bien(db, user, bien, "VIEW_LOT"):
        return True
    return user.role == UtilisateurRole.LOCATAIRE and _is_tenant_of_lot(db, user.id, lot.id)


def list_lots(db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100) -> list[Lot]:
    query = db.query(Lot).filter(Lot.deleted_at.is_(None))
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = query.join(Bien, Bien.id == Lot.bien_id).filter(
            Bien.proprietaire_id == current_user.id, Bien.deleted_at.is_(None)
        )
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = bien_ids_with_permission(db, current_user.id, "VIEW_LOT")
        if not ids:
            return []
        query = query.join(Bien, Bien.id == Lot.bien_id).filter(Bien.id.in_(ids), Bien.deleted_at.is_(None))
    elif current_user.role == UtilisateurRole.LOCATAIRE:
        query = query.join(Bail, Bail.lot_id == Lot.id).filter(Bail.locataire_id == current_user.id).distinct()
    return query.offset(skip).limit(limit).all()


def get_lot(db: Session, current_user: Utilisateur, lot_id: int) -> Lot:
    lot = (
        db.query(Lot)
        .filter(Lot.id == lot_id, Lot.deleted_at.is_(None))
        .first()
    )
    if not lot:
        raise NotFound("Lot not found")
    if not _can_view_lot(db, current_user, lot):
        raise Forbidden("Not allowed to access this lot")
    return lot


def create_lot(db: Session, current_user: Utilisateur, lot_in: LotCreate) -> Lot:
    bien = (
        db.query(Bien)
        .filter(Bien.id == lot_in.bien_id, Bien.deleted_at.is_(None))
        .first()
    )
    if not bien:
        raise NotFound("Property not found")
    if not has_permission_for_bien(db, current_user, bien, "CREATE_LOT"):
        raise Forbidden("Not allowed to add a lot to this property")
    lot = Lot(**lot_in.model_dump())
    db.add(lot)
    db.commit()
    db.refresh(lot)
    _notify_proprietaire_of_activity(
        db, current_user, bien.proprietaire_id, "Lot créé", "a ajouté le lot", f'"{lot.reference}"'
    )
    return lot


def update_lot(db: Session, current_user: Utilisateur, lot_id: int, lot_in: LotUpdate) -> Lot:
    lot = (
        db.query(Lot)
        .filter(Lot.id == lot_id, Lot.deleted_at.is_(None))
        .first()
    )
    if not lot:
        raise NotFound("Lot not found")
    bien = (
        db.query(Bien)
        .filter(Bien.id == lot.bien_id, Bien.deleted_at.is_(None))
        .first()
    )
    if not has_permission_for_bien(db, current_user, bien, "UPDATE_LOT"):
        raise Forbidden("Not allowed to modify this lot")
    for field, value in lot_in.model_dump(exclude_unset=True).items():
        setattr(lot, field, value)
    db.commit()
    db.refresh(lot)
    _notify_proprietaire_of_activity(
        db, current_user, bien.proprietaire_id, "Lot modifié", "a modifié le lot", f'"{lot.reference}"'
    )
    return lot


def delete_lot(db: Session, current_user: Utilisateur, lot_id: int) -> None:
    lot = (
        db.query(Lot)
        .filter(Lot.id == lot_id, Lot.deleted_at.is_(None))
        .first()
    )
    if not lot:
        raise NotFound("Lot not found")
    bien = (
        db.query(Bien)
        .filter(Bien.id == lot.bien_id, Bien.deleted_at.is_(None))
        .first()
    )
    if not has_permission_for_bien(db, current_user, bien, "DELETE_LOT"):
        raise Forbidden("Not allowed to delete this lot")
    has_active_bail = (
        db.query(Bail)
        .filter(Bail.lot_id == lot.id, Bail.deleted_at.is_(None), Bail.statut == BailStatus.ACTIF)
        .first()
    )
    if has_active_bail:
        raise BadRequest("Impossible de supprimer ce lot : il possède un bail actif.")
    lot.deleted_at = datetime.utcnow()
    db.commit()
    _notify_proprietaire_of_activity(
        db, current_user, bien.proprietaire_id, "Lot supprimé", "a supprimé le lot", f'"{lot.reference}"'
    )
