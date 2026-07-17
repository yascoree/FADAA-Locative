from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.paiement import Paiement
from app.models.quittance import Quittance
from app.schemas.paiement import PaiementCreate, PaiementRead, PaiementUpdate

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/", response_model=list[PaiementRead])
def list_paiements(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Paiement).offset(skip).limit(limit).all()


@router.post("/", response_model=PaiementRead, status_code=status.HTTP_201_CREATED)
def create_paiement(paiement_in: PaiementCreate, db: Session = Depends(get_db)):
    paiement = Paiement(**paiement_in.model_dump())
    db.add(paiement)
    db.commit()
    db.refresh(paiement)

    # Une quittance est générée automatiquement pour chaque paiement.
    quittance = Quittance(paiement_id=paiement.id)
    db.add(quittance)
    db.commit()

    return paiement


@router.get("/{paiement_id}", response_model=PaiementRead)
def get_paiement(paiement_id: int, db: Session = Depends(get_db)):
    paiement = db.get(Paiement, paiement_id)
    if not paiement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return paiement


@router.put("/{paiement_id}", response_model=PaiementRead)
def update_paiement(paiement_id: int, paiement_in: PaiementUpdate, db: Session = Depends(get_db)):
    paiement = db.get(Paiement, paiement_id)
    if not paiement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    for field, value in paiement_in.model_dump(exclude_unset=True).items():
        setattr(paiement, field, value)

    db.commit()
    db.refresh(paiement)
    return paiement
