from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.mandat import Mandat
from app.schemas.mandat import MandatCreate, MandatRead, MandatUpdate

router = APIRouter(prefix="/mandates", tags=["mandates"])


@router.get("/", response_model=list[MandatRead])
def list_mandats(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Mandat).offset(skip).limit(limit).all()


@router.post("/", response_model=MandatRead, status_code=status.HTTP_201_CREATED)
def create_mandat(mandat_in: MandatCreate, db: Session = Depends(get_db)):
    mandat = Mandat(**mandat_in.model_dump())
    db.add(mandat)
    db.commit()
    db.refresh(mandat)
    return mandat


@router.get("/{mandat_id}", response_model=MandatRead)
def get_mandat(mandat_id: int, db: Session = Depends(get_db)):
    mandat = db.get(Mandat, mandat_id)
    if not mandat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mandate not found")
    return mandat


@router.put("/{mandat_id}", response_model=MandatRead)
def update_mandat(mandat_id: int, mandat_in: MandatUpdate, db: Session = Depends(get_db)):
    mandat = db.get(Mandat, mandat_id)
    if not mandat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mandate not found")

    for field, value in mandat_in.model_dump(exclude_unset=True).items():
        setattr(mandat, field, value)

    db.commit()
    db.refresh(mandat)
    return mandat


@router.delete("/{mandat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mandat(mandat_id: int, db: Session = Depends(get_db)):
    mandat = db.get(Mandat, mandat_id)
    if not mandat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mandate not found")
    db.delete(mandat)
    db.commit()
