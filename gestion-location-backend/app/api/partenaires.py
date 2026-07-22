import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.database import get_db
from app.models.partenaire import Partenaire
from app.models.utilisateur import Utilisateur
from app.schemas.partenaire import PartenaireCreate, PartenaireRead, PartenaireUpdate

router = APIRouter(prefix="/partners", tags=["partners"])

# app/api/partenaires.py -> parents[2] = racine du backend (là où tourne uvicorn).
UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "partenaires"
ALLOWED_PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 Mo


@router.get("/", response_model=list[PartenaireRead])
def list_partenaires(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Partenaire).offset(skip).limit(limit).all()


@router.post("/", response_model=PartenaireRead, status_code=status.HTTP_201_CREATED)
def create_partenaire(
    partenaire_in: PartenaireCreate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    partenaire = Partenaire(**partenaire_in.model_dump())
    db.add(partenaire)
    db.commit()
    db.refresh(partenaire)
    return partenaire


@router.get("/{partenaire_id}", response_model=PartenaireRead)
def get_partenaire(partenaire_id: int, db: Session = Depends(get_db)):
    partenaire = db.get(Partenaire, partenaire_id)
    if not partenaire:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partenaire not found")
    return partenaire


@router.put("/{partenaire_id}", response_model=PartenaireRead)
def update_partenaire(
    partenaire_id: int,
    partenaire_in: PartenaireUpdate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    partenaire = db.get(Partenaire, partenaire_id)
    if not partenaire:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partenaire not found")

    for field, value in partenaire_in.model_dump(exclude_unset=True).items():
        setattr(partenaire, field, value)

    db.commit()
    db.refresh(partenaire)
    return partenaire


@router.delete("/{partenaire_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_partenaire(
    partenaire_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    partenaire = db.get(Partenaire, partenaire_id)
    if not partenaire:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partenaire not found")
    db.delete(partenaire)
    db.commit()


@router.post("/{partenaire_id}/logo", response_model=PartenaireRead)
async def upload_partenaire_logo(
    partenaire_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    partenaire = db.get(Partenaire, partenaire_id)
    if not partenaire:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partenaire not found")

    extension = ALLOWED_PHOTO_TYPES.get(file.content_type)
    if not extension:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only JPEG, PNG or WEBP images are allowed")

    content = await file.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be smaller than 5 MB")

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (UPLOAD_ROOT / filename).write_bytes(content)

    partenaire.logo = f"/uploads/partenaires/{filename}"
    db.commit()
    db.refresh(partenaire)
    return partenaire
