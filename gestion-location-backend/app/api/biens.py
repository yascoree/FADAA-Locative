from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bien import Bien
from app.schemas.bien import BienCreate, BienRead, BienUpdate

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("/", response_model=list[BienRead])
def list_biens(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Bien).offset(skip).limit(limit).all()


@router.post("/", response_model=BienRead, status_code=status.HTTP_201_CREATED)
def create_bien(bien_in: BienCreate, db: Session = Depends(get_db)):
    bien = Bien(**bien_in.model_dump())
    db.add(bien)
    db.commit()
    db.refresh(bien)
    return bien


@router.get("/{bien_id}", response_model=BienRead)
def get_bien(bien_id: int, db: Session = Depends(get_db)):
    bien = db.get(Bien, bien_id)
    if not bien:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return bien


@router.put("/{bien_id}", response_model=BienRead)
def update_bien(bien_id: int, bien_in: BienUpdate, db: Session = Depends(get_db)):
    bien = db.get(Bien, bien_id)
    if not bien:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    for field, value in bien_in.model_dump(exclude_unset=True).items():
        setattr(bien, field, value)

    db.commit()
    db.refresh(bien)
    return bien


@router.delete("/{bien_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bien(bien_id: int, db: Session = Depends(get_db)):
    bien = db.get(Bien, bien_id)
    if not bien:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    db.delete(bien)
    db.commit()
