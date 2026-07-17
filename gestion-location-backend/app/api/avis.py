from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.avis import Avis
from app.schemas.avis import AvisCreate, AvisRead, AvisUpdate

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/", response_model=list[AvisRead])
def list_avis(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Avis).offset(skip).limit(limit).all()


@router.post("/", response_model=AvisRead, status_code=status.HTTP_201_CREATED)
def create_avis(avis_in: AvisCreate, db: Session = Depends(get_db)):
    avis = Avis(**avis_in.model_dump())
    db.add(avis)
    db.commit()
    db.refresh(avis)
    return avis


@router.get("/{avis_id}", response_model=AvisRead)
def get_avis(avis_id: int, db: Session = Depends(get_db)):
    avis = db.get(Avis, avis_id)
    if not avis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avis not found")
    return avis


@router.put("/{avis_id}", response_model=AvisRead)
def update_avis(avis_id: int, avis_in: AvisUpdate, db: Session = Depends(get_db)):
    avis = db.get(Avis, avis_id)
    if not avis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avis not found")

    for field, value in avis_in.model_dump(exclude_unset=True).items():
        setattr(avis, field, value)

    db.commit()
    db.refresh(avis)
    return avis


@router.delete("/{avis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_avis(avis_id: int, db: Session = Depends(get_db)):
    avis = db.get(Avis, avis_id)
    if not avis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avis not found")
    db.delete(avis)
    db.commit()
