from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.quittance import Quittance
from app.schemas.quittance import QuittanceRead

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.get("/", response_model=list[QuittanceRead])
def list_quittances(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Quittance).offset(skip).limit(limit).all()


@router.get("/{quittance_id}", response_model=QuittanceRead)
def get_quittance(quittance_id: int, db: Session = Depends(get_db)):
    quittance = db.get(Quittance, quittance_id)
    if not quittance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    return quittance


@router.get("/{quittance_id}/download")
def download_quittance(quittance_id: int, db: Session = Depends(get_db)):
    quittance = db.get(Quittance, quittance_id)
    if not quittance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")

    if not quittance.fichier_pdf or not Path(quittance.fichier_pdf).is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF file not available")

    return FileResponse(
        quittance.fichier_pdf, media_type="application/pdf", filename=f"quittance_{quittance.id}.pdf"
    )
