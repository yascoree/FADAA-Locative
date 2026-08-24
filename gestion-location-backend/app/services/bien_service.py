import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.api.deps import bien_ids_with_permission, can_access_proprietaire, has_permission, has_permission_for_bien
from app.models.bail import Bail, BailStatus
from app.models.bien import Bien, BienStatus
from app.models.bien_photo import BienPhoto
from app.models.categorie import Categorie
from app.models.lot import Lot, LotStatus
from app.models.notification import NotificationType
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.bien import BienCreate, BienUpdate
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.push_service import send_push_to_user
from app.services.usage_service import enforce_limit
from datetime import datetime


def _notify_proprietaire_of_activity(
    db: Session, actor: Utilisateur, proprietaire_id: int, title: str, verbe: str, cible: str
) -> None:
    """Prévient le propriétaire quand un gestionnaire agit en son nom sur un bien/lot.
    ``title`` est le libellé court (ex. "Bien créé"), ``verbe`` la formulation de
    l'action au passé (ex. "a créé le bien"), ``cible`` la désignation concernée."""
    if actor.role != UtilisateurRole.GESTIONNAIRE:
        return
    send_push_to_user(
        db,
        user_id=proprietaire_id,
        title=title,
        body=f"{actor.prenom} {actor.nom} (gestionnaire) {verbe} {cible}.",
        notif_type=NotificationType.GESTION,
    )

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "biens"
ALLOWED_PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB


def _is_tenant_of_bien(db: Session, user_id: int, bien_id: int) -> bool:
    return (
        db.query(Bail)
        .join(Lot, Lot.id == Bail.lot_id)
        .filter(Lot.bien_id == bien_id, Bail.locataire_id == user_id)
        .first()
        is not None
    )


def _has_occupying_lot_or_bail(db: Session, bien_id: int) -> bool:
    """Vrai si un lot de ce bien est loué (occupé) ou possède un bail actif ou
    en attente — utilisé pour bloquer la suppression et les changements de
    statut incohérents (bien archivé/inactif alors qu'il est encore habité)."""
    occupied_lot = (
        db.query(Lot)
        .filter(Lot.bien_id == bien_id, Lot.deleted_at.is_(None), Lot.statut == LotStatus.LOUE)
        .first()
    )
    if occupied_lot:
        return True
    occupying_bail = (
        db.query(Bail)
        .join(Lot, Lot.id == Bail.lot_id)
        .filter(
            Lot.bien_id == bien_id,
            Lot.deleted_at.is_(None),
            Bail.deleted_at.is_(None),
            Bail.statut.in_((BailStatus.ACTIF, BailStatus.EN_ATTENTE)),
        )
        .first()
    )
    return occupying_bail is not None


def _can_view_bien(db: Session, user: Utilisateur, bien: Bien) -> bool:
    if has_permission_for_bien(db, user, bien, "VIEW_PROPERTY"):
        return True
    return user.role == UtilisateurRole.LOCATAIRE and _is_tenant_of_bien(db, user.id, bien.id)


def list_biens(
    db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100, proprietaire_id: int | None = None
) -> list[Bien]:
    if proprietaire_id is not None and not can_access_proprietaire(db, current_user, proprietaire_id):
        raise Forbidden("Not allowed to access this proprietaire")
    query = db.query(Bien).filter(Bien.deleted_at.is_(None))
    if proprietaire_id is not None:
        query = query.filter(Bien.proprietaire_id == proprietaire_id)
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = query.filter(Bien.proprietaire_id == current_user.id)
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = bien_ids_with_permission(db, current_user.id, "VIEW_PROPERTY")
        if not ids:
            return []
        query = query.filter(Bien.id.in_(ids))
    elif current_user.role == UtilisateurRole.LOCATAIRE:
        query = (
            query.join(Lot, Lot.bien_id == Bien.id)
            .join(Bail, Bail.lot_id == Lot.id)
            .filter(Bail.locataire_id == current_user.id)
            .distinct()
        )
    return query.offset(skip).limit(limit).all()


def get_bien(db: Session, current_user: Utilisateur, bien_id: int) -> Bien:
    bien = (
        db.query(Bien)
        .filter(Bien.id == bien_id, Bien.deleted_at.is_(None))
        .first()
    )
    if not bien:
        raise NotFound("Property not found")
    if not _can_view_bien(db, current_user, bien):
        raise Forbidden("Not allowed to access this property")
    return bien


def create_bien(db: Session, current_user: Utilisateur, bien_in: BienCreate) -> Bien:
    if not has_permission(db, current_user, bien_in.proprietaire_id, "CREATE_PROPERTY"):
        raise Forbidden("Cannot create a property for this proprietaire")
    enforce_limit(db, current_user, "biens", target_proprietaire_id=bien_in.proprietaire_id)
    bien = Bien(**bien_in.model_dump())
    db.add(bien)
    db.commit()
    db.refresh(bien)
    _notify_proprietaire_of_activity(
        db, current_user, bien.proprietaire_id, "Bien créé", "a ajouté le bien", f'"{bien.designation}"'
    )
    return bien


def update_bien(db: Session, current_user: Utilisateur, bien_id: int, bien_in: BienUpdate) -> Bien:
    bien = (
        db.query(Bien)
        .filter(Bien.id == bien_id, Bien.deleted_at.is_(None))
        .first()
    )
    if not bien:
        raise NotFound("Property not found")
    if not has_permission_for_bien(db, current_user, bien, "UPDATE_PROPERTY"):
        raise Forbidden("Not allowed to modify this property")
    update_data = bien_in.model_dump(exclude_unset=True)
    new_statut = update_data.get("statut")
    if new_statut in (BienStatus.INACTIF, BienStatus.ARCHIVE) and _has_occupying_lot_or_bail(db, bien.id):
        raise BadRequest(
            "Impossible de passer ce bien en inactif/archivé : un de ses lots est loué "
            "ou possède un bail actif ou en attente."
        )
    new_type = update_data.get("type")
    if new_type is not None and new_type != bien.type:
        mismatched_lot = (
            db.query(Lot)
            .join(Categorie, Categorie.id == Lot.categorie_id)
            .filter(Lot.bien_id == bien.id, Lot.deleted_at.is_(None), Categorie.type_bien != new_type)
            .first()
        )
        if mismatched_lot:
            raise BadRequest(
                "Impossible de changer le type de ce bien : au moins un de ses lots a une "
                "sous-catégorie qui ne correspond pas au nouveau type."
            )
    for field, value in update_data.items():
        setattr(bien, field, value)
    db.commit()
    db.refresh(bien)
    _notify_proprietaire_of_activity(
        db, current_user, bien.proprietaire_id, "Bien modifié", "a modifié le bien", f'"{bien.designation}"'
    )
    return bien


def delete_bien(db: Session, current_user: Utilisateur, bien_id: int) -> None:
    bien = (
        db.query(Bien)
        .filter(Bien.id == bien_id, Bien.deleted_at.is_(None))
        .first()
    )
    if not bien:
        raise NotFound("Property not found")
    if not has_permission_for_bien(db, current_user, bien, "DELETE_PROPERTY"):
        raise Forbidden("Not allowed to delete this property")
    if _has_occupying_lot_or_bail(db, bien.id):
        raise BadRequest(
            "Impossible de supprimer ce bien : un de ses lots est loué ou possède un bail actif ou en attente."
        )
    bien.deleted_at = datetime.utcnow()
    db.commit()
    _notify_proprietaire_of_activity(
        db, current_user, bien.proprietaire_id, "Bien supprimé", "a supprimé le bien", f'"{bien.designation}"'
    )


async def upload_bien_photo(
    db: Session,
    current_user: Utilisateur,
    bien_id: int,
    file_content: bytes,
    content_type: str,
) -> BienPhoto:
    bien = db.get(Bien, bien_id)
    if not bien:
        raise NotFound("Property not found")
    if not has_permission_for_bien(db, current_user, bien, "UPDATE_PROPERTY"):
        raise Forbidden("Not allowed to modify this property")

    extension = ALLOWED_PHOTO_TYPES.get(content_type)
    if not extension:
        raise BadRequest("Only JPEG, PNG or WEBP images are allowed")
    if len(file_content) > MAX_PHOTO_SIZE:
        raise BadRequest("Image must be smaller than 5 MB")

    bien_dir = UPLOAD_ROOT / str(bien_id)
    bien_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (bien_dir / filename).write_bytes(file_content)

    photo = BienPhoto(bien_id=bien_id, url=f"/uploads/biens/{bien_id}/{filename}")
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


def delete_bien_photo(db: Session, current_user: Utilisateur, bien_id: int, photo_id: int) -> None:
    bien = db.get(Bien, bien_id)
    if not bien:
        raise NotFound("Property not found")
    if not has_permission_for_bien(db, current_user, bien, "UPDATE_PROPERTY"):
        raise Forbidden("Not allowed to modify this property")

    photo = db.get(BienPhoto, photo_id)
    if not photo or photo.bien_id != bien_id:
        raise NotFound("Photo not found")

    file_path = Path(__file__).resolve().parents[2] / photo.url.lstrip("/")
    db.delete(photo)
    db.commit()
    if file_path.exists():
        file_path.unlink()
