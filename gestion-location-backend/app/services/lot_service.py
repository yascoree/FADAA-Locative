import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.api.deps import bien_ids_with_permission, can_access_proprietaire, has_permission_for_bien
from app.models.bail import Bail, BailStatus
from app.models.bien import Bien
from app.models.categorie import Categorie
from app.models.lot import Lot
from app.models.lot_photo import LotPhoto
from app.models.notification import NotificationType
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.lot import LotCreate, LotUpdate
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.push_service import send_push_to_user
from app.services.usage_service import enforce_limit

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "lots"
ALLOWED_PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB


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


def _has_occupying_bail(db: Session, lot_id: int, exclude_bail_id: int | None = None) -> bool:
    query = db.query(Bail).filter(
        Bail.lot_id == lot_id,
        Bail.deleted_at.is_(None),
        Bail.statut.in_((BailStatus.ACTIF, BailStatus.EN_ATTENTE)),
    )
    if exclude_bail_id is not None:
        query = query.filter(Bail.id != exclude_bail_id)
    return query.first() is not None


def _check_categorie_matches_bien_type(db: Session, bien: Bien, categorie_id: int | None) -> None:
    """La sous-catégorie d'un lot doit appartenir au même type_bien que son bien
    parent (ex. un bien VEHICULE ne peut pas avoir un lot catégorisé Appartement)."""
    if categorie_id is None:
        return
    categorie = (
        db.query(Categorie)
        .filter(Categorie.id == categorie_id, Categorie.deleted_at.is_(None))
        .first()
    )
    if not categorie:
        raise NotFound("Category not found")
    if categorie.type_bien != bien.type:
        raise BadRequest(
            f'Cette catégorie ne correspond pas au type du bien ("{bien.type.name}").'
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


def list_lots(
    db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100, proprietaire_id: int | None = None
) -> list[Lot]:
    if proprietaire_id is not None and not can_access_proprietaire(db, current_user, proprietaire_id):
        raise Forbidden("Not allowed to access this proprietaire")
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
    if proprietaire_id is not None:
        if current_user.role == UtilisateurRole.LOCATAIRE:
            query = query.join(Bien, Bien.id == Lot.bien_id)
        query = query.filter(Bien.proprietaire_id == proprietaire_id, Bien.deleted_at.is_(None))
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
    _check_categorie_matches_bien_type(db, bien, lot_in.categorie_id)
    enforce_limit(db, bien.proprietaire_id, "lots")
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
    update_data = lot_in.model_dump(exclude_unset=True)
    if (
        "statut" in update_data
        and update_data["statut"] != lot.statut
        and _has_occupying_bail(db, lot.id)
    ):
        raise BadRequest(
            "Impossible de modifier le statut de ce lot : un bail actif ou en attente "
            "existe encore. Modifiez ou résiliez ce bail pour changer le statut du lot."
        )
    if "categorie_id" in update_data:
        _check_categorie_matches_bien_type(db, bien, update_data["categorie_id"])
    for field, value in update_data.items():
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
    if _has_occupying_bail(db, lot.id):
        raise BadRequest("Impossible de supprimer ce lot : un bail actif ou en attente existe encore.")
    lot.deleted_at = datetime.utcnow()
    db.commit()
    _notify_proprietaire_of_activity(
        db, current_user, bien.proprietaire_id, "Lot supprimé", "a supprimé le lot", f'"{lot.reference}"'
    )


async def upload_lot_photo(
    db: Session,
    current_user: Utilisateur,
    lot_id: int,
    file_content: bytes,
    content_type: str,
) -> LotPhoto:
    lot = db.get(Lot, lot_id)
    if not lot:
        raise NotFound("Lot not found")
    bien = db.get(Bien, lot.bien_id)
    if not has_permission_for_bien(db, current_user, bien, "UPDATE_LOT"):
        raise Forbidden("Not allowed to modify this lot")

    extension = ALLOWED_PHOTO_TYPES.get(content_type)
    if not extension:
        raise BadRequest("Only JPEG, PNG or WEBP images are allowed")
    if len(file_content) > MAX_PHOTO_SIZE:
        raise BadRequest("Image must be smaller than 5 MB")

    lot_dir = UPLOAD_ROOT / str(lot_id)
    lot_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (lot_dir / filename).write_bytes(file_content)

    photo = LotPhoto(lot_id=lot_id, url=f"/uploads/lots/{lot_id}/{filename}")
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


def delete_lot_photo(db: Session, current_user: Utilisateur, lot_id: int, photo_id: int) -> None:
    lot = db.get(Lot, lot_id)
    if not lot:
        raise NotFound("Lot not found")
    bien = db.get(Bien, lot.bien_id)
    if not has_permission_for_bien(db, current_user, bien, "UPDATE_LOT"):
        raise Forbidden("Not allowed to modify this lot")

    photo = db.get(LotPhoto, photo_id)
    if not photo or photo.lot_id != lot_id:
        raise NotFound("Photo not found")

    file_path = Path(__file__).resolve().parents[2] / photo.url.lstrip("/")
    db.delete(photo)
    db.commit()
    if file_path.exists():
        file_path.unlink()
