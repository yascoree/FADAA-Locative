import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import can_view_proprietaire, get_current_user, has_permission, managed_proprietaire_ids, require_gestion
from app.database import get_db
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.bien_photo import BienPhoto
from app.models.lot import Lot
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.bien import BienCreate, BienRead, BienUpdate
from app.schemas.bien_photo import BienPhotoRead

router = APIRouter(prefix="/properties", tags=["properties"])

# app/api/biens.py -> parents[2] = racine du backend (là où tourne uvicorn).
UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "biens"
ALLOWED_PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 Mo


def _is_tenant_of_bien(db: Session, user_id: int, bien_id: int) -> bool:
    return (
        db.query(Bail)
        .join(Lot, Lot.id == Bail.lot_id)
        .filter(Lot.bien_id == bien_id, Bail.locataire_id == user_id)
        .first()
        is not None
    )


def _can_view_bien(db: Session, user: Utilisateur, bien: Bien) -> bool:
    if can_view_proprietaire(db, user, bien.proprietaire_id):
        return True
    return user.role == UtilisateurRole.LOCATAIRE and _is_tenant_of_bien(db, user.id, bien.id)


@router.get("/", response_model=list[BienRead])
def list_biens(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Bien)
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = query.filter(Bien.proprietaire_id == current_user.id)
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = managed_proprietaire_ids(db, current_user.id)
        if not ids:
            return []
        query = query.filter(Bien.proprietaire_id.in_(ids))
    elif current_user.role == UtilisateurRole.LOCATAIRE:
        query = (
            query.join(Lot, Lot.bien_id == Bien.id)
            .join(Bail, Bail.lot_id == Lot.id)
            .filter(Bail.locataire_id == current_user.id)
            .distinct()
        )
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=BienRead, status_code=status.HTTP_201_CREATED)
def create_bien(
    bien_in: BienCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_gestion),
):
    if not has_permission(db, current_user, bien_in.proprietaire_id, "CREATE_PROPERTY"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create a property for this proprietaire",
        )
    bien = Bien(**bien_in.model_dump())
    db.add(bien)
    db.commit()
    db.refresh(bien)
    return bien


@router.get("/{bien_id}", response_model=BienRead)
def get_bien(
    bien_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    bien = db.get(Bien, bien_id)
    if not bien:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if not _can_view_bien(db, current_user, bien):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this property")
    return bien


@router.put("/{bien_id}", response_model=BienRead)
def update_bien(
    bien_id: int,
    bien_in: BienUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    bien = db.get(Bien, bien_id)
    if not bien:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if not has_permission(db, current_user, bien.proprietaire_id, "UPDATE_PROPERTY"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this property")

    for field, value in bien_in.model_dump(exclude_unset=True).items():
        setattr(bien, field, value)

    db.commit()
    db.refresh(bien)
    return bien


@router.delete("/{bien_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bien(
    bien_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    bien = db.get(Bien, bien_id)
    if not bien:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if not has_permission(db, current_user, bien.proprietaire_id, "DELETE_PROPERTY"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this property")
    db.delete(bien)
    db.commit()


@router.post("/{bien_id}/photos", response_model=BienPhotoRead, status_code=status.HTTP_201_CREATED)
async def upload_bien_photo(
    bien_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    bien = db.get(Bien, bien_id)
    if not bien:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if not has_permission(db, current_user, bien.proprietaire_id, "UPDATE_PROPERTY"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this property")

    extension = ALLOWED_PHOTO_TYPES.get(file.content_type)
    if not extension:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only JPEG, PNG or WEBP images are allowed")

    content = await file.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be smaller than 5 MB")

    bien_dir = UPLOAD_ROOT / str(bien_id)
    bien_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (bien_dir / filename).write_bytes(content)

    photo = BienPhoto(bien_id=bien_id, url=f"/uploads/biens/{bien_id}/{filename}")
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/{bien_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bien_photo(
    bien_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    bien = db.get(Bien, bien_id)
    if not bien:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if not has_permission(db, current_user, bien.proprietaire_id, "UPDATE_PROPERTY"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this property")

    photo = db.get(BienPhoto, photo_id)
    if not photo or photo.bien_id != bien_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")

    file_path = Path(__file__).resolve().parents[2] / photo.url.lstrip("/")
    db.delete(photo)
    db.commit()
    if file_path.exists():
        file_path.unlink()
