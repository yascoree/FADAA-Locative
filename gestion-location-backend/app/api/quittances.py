from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.quittance import QuittanceRead
from app.services import quittance_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.get("/", response_model=list[QuittanceRead])
def list_quittances(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return quittance_service.list_quittances(db, current_user, skip, limit)


@router.get("/{quittance_id}", response_model=QuittanceRead)
def get_quittance(
    quittance_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return quittance_service.get_quittance(db, current_user, quittance_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get("/{quittance_id}/download")
def download_quittance(
    quittance_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        pdf_path = quittance_service.get_quittance_pdf_path(db, current_user, quittance_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    return FileResponse(pdf_path, media_type="application/pdf", filename=f"quittance_{quittance_id}.pdf")


@router.post("/{quittance_id}/annuler", response_model=QuittanceRead)
def annuler_quittance(
    quittance_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return quittance_service.annuler_quittance(db, current_user, quittance_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
