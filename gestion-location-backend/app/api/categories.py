from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.categorie import CategorieCreate, CategorieRead, CategorieUpdate
from app.services import categorie_service
from app.services.exceptions import BadRequest, NotFound

router = APIRouter(prefix="/categories", tags=["categories"])

# Shared reference data (property types used by all proprietaires/gestionnaires):
# read is public, mutations are admin-only to avoid duplicates/inconsistencies,
# same logic as /partners.


@router.get("/", response_model=list[CategorieRead])
def list_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return categorie_service.list_categories(db, skip, limit)


@router.post("/", response_model=CategorieRead, status_code=status.HTTP_201_CREATED)
def create_categorie(
    categorie_in: CategorieCreate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    return categorie_service.create_categorie(db, categorie_in)


@router.get("/{categorie_id}", response_model=CategorieRead)
def get_categorie(categorie_id: int, db: Session = Depends(get_db)):
    try:
        return categorie_service.get_categorie(db, categorie_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{categorie_id}", response_model=CategorieRead)
def update_categorie(
    categorie_id: int,
    categorie_in: CategorieUpdate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    try:
        return categorie_service.update_categorie(db, categorie_id, categorie_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{categorie_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_categorie(
    categorie_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    try:
        categorie_service.delete_categorie(db, categorie_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
