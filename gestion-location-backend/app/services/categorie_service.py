from datetime import datetime

from sqlalchemy.orm import Session

from app.models.bien import Bien
from app.models.categorie import Categorie
from app.schemas.categorie import CategorieCreate, CategorieUpdate
from app.services.exceptions import BadRequest, NotFound


def list_categories(db: Session, skip: int = 0, limit: int = 100) -> list[Categorie]:
    return (
        db.query(Categorie)
        .filter(Categorie.deleted_at.is_(None))
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_categorie(db: Session, categorie_id: int) -> Categorie:
    categorie = (
        db.query(Categorie)
        .filter(Categorie.id == categorie_id, Categorie.deleted_at.is_(None))
        .first()
    )
    if not categorie:
        raise NotFound("Category not found")
    return categorie


def create_categorie(db: Session, categorie_in: CategorieCreate) -> Categorie:
    categorie = Categorie(**categorie_in.model_dump())
    db.add(categorie)
    db.commit()
    db.refresh(categorie)
    return categorie


def update_categorie(db: Session, categorie_id: int, categorie_in: CategorieUpdate) -> Categorie:
    categorie = (
        db.query(Categorie)
        .filter(Categorie.id == categorie_id, Categorie.deleted_at.is_(None))
        .first()
    )
    if not categorie:
        raise NotFound("Category not found")

    # Renommer une catégorie n'affecte pas les biens qui la référencent (même
    # categorie_id) : autorisé même si elle est utilisée. Seule la suppression
    # est bloquée dans ce cas (voir delete_categorie).
    updates = categorie_in.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(categorie, field, value)
    db.commit()
    db.refresh(categorie)
    return categorie


def delete_categorie(db: Session, categorie_id: int) -> None:
    categorie = (
        db.query(Categorie)
        .filter(Categorie.id == categorie_id, Categorie.deleted_at.is_(None))
        .first()
    )
    if not categorie:
        raise NotFound("Category not found")

    in_use = (
        db.query(Bien)
        .filter(Bien.categorie_id == categorie_id, Bien.deleted_at.is_(None))
        .first()
        is not None
    )
    if in_use:
        raise BadRequest("Category is used by existing properties")

    categorie.deleted_at = datetime.utcnow()
    db.commit()
