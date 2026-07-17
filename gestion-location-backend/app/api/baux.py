from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bail import Bail
from app.schemas.bail import BailCreate, BailRead, BailUpdate

router = APIRouter(prefix="/leases", tags=["leases"])


@router.get("/", response_model=list[BailRead])
def list_baux(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Bail).offset(skip).limit(limit).all()


@router.post("/", response_model=BailRead, status_code=status.HTTP_201_CREATED)
def create_bail(bail_in: BailCreate, db: Session = Depends(get_db)):
    bail = Bail(**bail_in.model_dump())
    db.add(bail)
    db.commit()
    db.refresh(bail)
    return bail


@router.get("/{bail_id}", response_model=BailRead)
def get_bail(bail_id: int, db: Session = Depends(get_db)):
    bail = db.get(Bail, bail_id)
    if not bail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lease not found")
    return bail


@router.put("/{bail_id}", response_model=BailRead)
def update_bail(bail_id: int, bail_in: BailUpdate, db: Session = Depends(get_db)):
    bail = db.get(Bail, bail_id)
    if not bail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lease not found")

    for field, value in bail_in.model_dump(exclude_unset=True).items():
        setattr(bail, field, value)

    db.commit()
    db.refresh(bail)
    return bail


@router.delete("/{bail_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bail(bail_id: int, db: Session = Depends(get_db)):
    bail = db.get(Bail, bail_id)
    if not bail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lease not found")
    db.delete(bail)
    db.commit()
