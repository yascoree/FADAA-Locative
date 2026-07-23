import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.profil import Profil
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.profil import ProfilCreate, ProfilUpdate
from app.services.exceptions import BadRequest, Forbidden, NotFound

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "profils"
ALLOWED_PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB


def _ensure_owner_or_admin(current_user: Utilisateur, utilisateur_id: int) -> None:
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != utilisateur_id:
        raise Forbidden("Not allowed to access this profile")


def _get_or_init_profil(db: Session, utilisateur_id: int) -> Profil:
    profil = (
        db.query(Profil)
        .filter(Profil.utilisateur_id == utilisateur_id, Profil.deleted_at.is_(None))
        .first()
    )
    if profil:
        return profil
    profil = Profil(utilisateur_id=utilisateur_id)
    db.add(profil)
    db.commit()
    db.refresh(profil)
    return profil


def get_profil(db: Session, current_user: Utilisateur, utilisateur_id: int) -> Profil:
    _ensure_owner_or_admin(current_user, utilisateur_id)
    profil = (
        db.query(Profil)
        .filter(Profil.utilisateur_id == utilisateur_id, Profil.deleted_at.is_(None))
        .first()
    )
    if not profil:
        raise NotFound("Profile not found")
    return profil


def create_profil(db: Session, current_user: Utilisateur, profil_in: ProfilCreate) -> Profil:
    _ensure_owner_or_admin(current_user, profil_in.utilisateur_id)
    existing = (
        db.query(Profil)
        .filter(Profil.utilisateur_id == profil_in.utilisateur_id, Profil.deleted_at.is_(None))
        .first()
    )
    if existing:
        raise BadRequest("Profile already exists")
    profil = Profil(**profil_in.model_dump())
    db.add(profil)
    db.commit()
    db.refresh(profil)
    return profil


def update_profil(db: Session, current_user: Utilisateur, utilisateur_id: int, profil_in: ProfilUpdate) -> Profil:
    _ensure_owner_or_admin(current_user, utilisateur_id)
    profil = (
        db.query(Profil)
        .filter(Profil.utilisateur_id == utilisateur_id, Profil.deleted_at.is_(None))
        .first()
    )
    if not profil:
        raise NotFound("Profile not found")
    for field, value in profil_in.model_dump(exclude_unset=True).items():
        setattr(profil, field, value)
    db.commit()
    db.refresh(profil)
    return profil


def upload_profil_photo(
    db: Session, current_user: Utilisateur, utilisateur_id: int, file_content: bytes, content_type: str
) -> Profil:
    _ensure_owner_or_admin(current_user, utilisateur_id)

    extension = ALLOWED_PHOTO_TYPES.get(content_type)
    if not extension:
        raise BadRequest("Only JPEG, PNG or WEBP images are allowed")
    if len(file_content) > MAX_PHOTO_SIZE:
        raise BadRequest("Image must be smaller than 5 MB")

    # A profile might not exist yet (settings page lets photo be the first thing saved).
    profil = _get_or_init_profil(db, utilisateur_id)
    old_photo = profil.photo

    user_dir = UPLOAD_ROOT / str(utilisateur_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (user_dir / filename).write_bytes(file_content)

    profil.photo = f"/uploads/profils/{utilisateur_id}/{filename}"
    db.commit()
    db.refresh(profil)

    if old_photo:
        old_path = Path(__file__).resolve().parents[2] / old_photo.lstrip("/")
        if old_path.exists():
            old_path.unlink()

    return profil


def delete_profil_photo(db: Session, current_user: Utilisateur, utilisateur_id: int) -> Profil:
    _ensure_owner_or_admin(current_user, utilisateur_id)
    profil = (
        db.query(Profil)
        .filter(Profil.utilisateur_id == utilisateur_id, Profil.deleted_at.is_(None))
        .first()
    )
    if not profil:
        raise NotFound("Profile not found")
    if profil.photo:
        old_path = Path(__file__).resolve().parents[2] / profil.photo.lstrip("/")
        profil.photo = None
        db.commit()
        db.refresh(profil)
        if old_path.exists():
            old_path.unlink()
    return profil
