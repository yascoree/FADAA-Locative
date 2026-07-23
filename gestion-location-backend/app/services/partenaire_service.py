import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.partenaire import Partenaire
from app.schemas.partenaire import PartenaireCreate, PartenaireUpdate
from app.services.exceptions import BadRequest, NotFound

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "partenaires"
ALLOWED_PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB


def list_partenaires(db: Session, skip: int = 0, limit: int = 100) -> list[Partenaire]:
    return db.query(Partenaire).filter(Partenaire.deleted_at.is_(None)).offset(skip).limit(limit).all()


def get_partenaire(db: Session, partenaire_id: int) -> Partenaire:
    partenaire = (
        db.query(Partenaire)
        .filter(Partenaire.id == partenaire_id, Partenaire.deleted_at.is_(None))
        .first()
    )
    if not partenaire:
        raise NotFound("Partenaire not found")
    return partenaire


def create_partenaire(db: Session, partenaire_in: PartenaireCreate) -> Partenaire:
    partenaire = Partenaire(**partenaire_in.model_dump())
    db.add(partenaire)
    db.commit()
    db.refresh(partenaire)
    return partenaire


def update_partenaire(db: Session, partenaire_id: int, partenaire_in: PartenaireUpdate) -> Partenaire:
    partenaire = (
        db.query(Partenaire)
        .filter(Partenaire.id == partenaire_id, Partenaire.deleted_at.is_(None))
        .first()
    )
    if not partenaire:
        raise NotFound("Partenaire not found")
    for field, value in partenaire_in.model_dump(exclude_unset=True).items():
        setattr(partenaire, field, value)
    db.commit()
    db.refresh(partenaire)
    return partenaire


def delete_partenaire(db: Session, partenaire_id: int) -> None:
    partenaire = (
        db.query(Partenaire)
        .filter(Partenaire.id == partenaire_id, Partenaire.deleted_at.is_(None))
        .first()
    )
    if not partenaire:
        raise NotFound("Partenaire not found")
    partenaire.deleted_at = datetime.utcnow()
    db.commit()


async def upload_partenaire_logo(
    db: Session,
    partenaire_id: int,
    file_content: bytes,
    content_type: str,
) -> Partenaire:
    partenaire = db.get(Partenaire, partenaire_id)
    if not partenaire:
        raise NotFound("Partenaire not found")

    extension = ALLOWED_PHOTO_TYPES.get(content_type)
    if not extension:
        raise BadRequest("Only JPEG, PNG or WEBP images are allowed")
    if len(file_content) > MAX_PHOTO_SIZE:
        raise BadRequest("Image must be smaller than 5 MB")

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (UPLOAD_ROOT / filename).write_bytes(file_content)

    partenaire.logo = f"/uploads/partenaires/{filename}"
    db.commit()
    db.refresh(partenaire)
    return partenaire
