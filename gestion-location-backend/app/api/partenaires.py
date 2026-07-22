from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.api.deps import require_admin
from app.database import get_db
from app.models.partenaire import Partenaire
from app.models.utilisateur import Utilisateur
from app.schemas.partenaire import PartenaireCreate, PartenaireRead, PartenaireUpdate

router = APIRouter(prefix="/partners", tags=["partners"])


@router.get("/", response_model=list[PartenaireRead])
def list_partenaires(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # return db.query(Partenaire).offset(skip).limit(limit).all()
    return (db.query(Partenaire).filter(Partenaire.deleted_at.is_(None)).offset(skip).limit(limit).all())


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
    # partenaire = db.get(Partenaire, partenaire_id)
    partenaire = (
    db.query(Partenaire)
    .filter(
        Partenaire.id == partenaire_id,
        Partenaire.deleted_at.is_(None)
    )
    .first()
    )
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
    # partenaire = db.get(Partenaire, partenaire_id)

    partenaire = (
    db.query(Partenaire)
    .filter(
        Partenaire.id == partenaire_id,
        Partenaire.deleted_at.is_(None)
    )
    .first()
    )
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
    # partenaire = db.get(Partenaire, partenaire_id)
    partenaire = (
    db.query(Partenaire)
    .filter(
        Partenaire.id == partenaire_id,
        Partenaire.deleted_at.is_(None)
    )
    .first()
    )
    if not partenaire:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partenaire not found")
    # db.delete(partenaire)
    partenaire.deleted_at = datetime.utcnow()
    db.commit()
