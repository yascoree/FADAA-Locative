from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.api.deps import require_admin
from app.database import get_db
from app.models.bien import Bien
from app.models.categorie import Categorie
from app.models.utilisateur import Utilisateur
from app.schemas.categorie import CategorieCreate, CategorieRead, CategorieUpdate

router = APIRouter(prefix="/categories", tags=["categories"])

# Référentiel partagé (les types de bien utilisés par tous les propriétaires/gestionnaires) :
# lecture publique, mutations réservées aux admins pour éviter les doublons/incohérences,
# même logique que /partners.


@router.get("/", response_model=list[CategorieRead])
def list_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # return db.query(Categorie).offset(skip).limit(limit).all()
    return (
    db.query(Categorie)
    .filter(Categorie.deleted_at.is_(None))
    .offset(skip)
    .limit(limit)
    .all()
    )


@router.post("/", response_model=CategorieRead, status_code=status.HTTP_201_CREATED)
def create_categorie(
    categorie_in: CategorieCreate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    categorie = Categorie(**categorie_in.model_dump())
    db.add(categorie)
    db.commit()
    db.refresh(categorie)
    return categorie


@router.get("/{categorie_id}", response_model=CategorieRead)
def get_categorie(categorie_id: int, db: Session = Depends(get_db)):
    # categorie = db.get(Categorie, categorie_id)

    categorie = (
    db.query(Categorie)
    .filter(
        Categorie.id == categorie_id,
        Categorie.deleted_at.is_(None)
    )
    .first()
    )
    if not categorie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return categorie


@router.put("/{categorie_id}", response_model=CategorieRead)
def update_categorie(
    categorie_id: int,
    categorie_in: CategorieUpdate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    # categorie = db.get(Categorie, categorie_id)
    categorie = (
    db.query(Categorie)
    .filter(
        Categorie.id == categorie_id,
        Categorie.deleted_at.is_(None)
    )
    .first()
    )
    if not categorie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    for field, value in categorie_in.model_dump(exclude_unset=True).items():
        setattr(categorie, field, value)

    db.commit()
    db.refresh(categorie)
    return categorie


@router.delete("/{categorie_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_categorie(
    categorie_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    # categorie = db.get(Categorie, categorie_id)

    categorie = (
    db.query(Categorie)
    .filter(
        Categorie.id == categorie_id,
        Categorie.deleted_at.is_(None)
    )
    .first()
    )
    if not categorie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    in_use = (
    db.query(Bien)
    .filter(
        Bien.categorie_id == categorie_id,
        Bien.deleted_at.is_(None)
    )
    .first()
    is not None
    )
    if in_use:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category is used by existing properties")

    # db.delete(categorie)
    categorie.deleted_at = datetime.utcnow()

    db.commit()
