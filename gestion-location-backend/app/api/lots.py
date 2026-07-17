from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.lot import Lot
from app.schemas.lot import LotCreate, LotRead, LotUpdate

router = APIRouter(prefix="/lots", tags=["lots"])


@router.get("/", response_model=list[LotRead])
def list_lots(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Lot).offset(skip).limit(limit).all()


@router.post("/", response_model=LotRead, status_code=status.HTTP_201_CREATED)
def create_lot(lot_in: LotCreate, db: Session = Depends(get_db)):
    lot = Lot(**lot_in.model_dump())
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot


@router.get("/{lot_id}", response_model=LotRead)
def get_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lot not found")
    return lot


@router.put("/{lot_id}", response_model=LotRead)
def update_lot(lot_id: int, lot_in: LotUpdate, db: Session = Depends(get_db)):
    lot = db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lot not found")

    for field, value in lot_in.model_dump(exclude_unset=True).items():
        setattr(lot, field, value)

    db.commit()
    db.refresh(lot)
    return lot


@router.delete("/{lot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lot not found")
    db.delete(lot)
    db.commit()
