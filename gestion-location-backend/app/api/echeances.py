from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.echeance import Echeance
from app.schemas.echeance import EcheanceCreate, EcheanceRead, EcheanceUpdate

router = APIRouter(prefix="/due-dates", tags=["due-dates"])


@router.get("/", response_model=list[EcheanceRead])
def list_echeances(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Echeance).offset(skip).limit(limit).all()

"""
@router.post("/", response_model=EcheanceRead, status_code=status.HTTP_201_CREATED)
def create_echeance(echeance_in: EcheanceCreate, db: Session = Depends(get_db)):
    # Les échéances sont normalement générées automatiquement à la création
    # d'un bail ; cet endpoint reste exposé pour permettre la saisie manuelle.
    echeance = Echeance(**echeance_in.model_dump())
    db.add(echeance)
    db.commit()
    db.refresh(echeance)
    return echeance 
"""

@router.get("/{echeance_id}", response_model=EcheanceRead)
def get_echeance(echeance_id: int, db: Session = Depends(get_db)):
    echeance = db.get(Echeance, echeance_id)
    if not echeance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Due date not found")
    return echeance


@router.put("/{echeance_id}", response_model=EcheanceRead)
def update_echeance(echeance_id: int, echeance_in: EcheanceUpdate, db: Session = Depends(get_db)):
    echeance = db.get(Echeance, echeance_id)
    if not echeance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Due date not found")

    for field, value in echeance_in.model_dump(exclude_unset=True).items():
        setattr(echeance, field, value)

    db.commit()
    db.refresh(echeance)
    return echeance
