from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_gestion
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.lot import LotCreate, LotRead, LotUpdate
from app.schemas.lot_photo import LotPhotoRead
from app.services import lot_service
from app.services.exceptions import BadRequest, Forbidden, NotFound, PaymentRequired

router = APIRouter(prefix="/lots", tags=["lots"])


@router.get("/", response_model=list[LotRead])
def list_lots(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return lot_service.list_lots(db, current_user, skip, limit)


@router.post("/", response_model=LotRead, status_code=status.HTTP_201_CREATED)
def create_lot(
    lot_in: LotCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_gestion),
):
    try:
        return lot_service.create_lot(db, current_user, lot_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except PaymentRequired as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))


@router.get("/{lot_id}", response_model=LotRead)
def get_lot(
    lot_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return lot_service.get_lot(db, current_user, lot_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.put("/{lot_id}", response_model=LotRead)
def update_lot(
    lot_id: int,
    lot_in: LotUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return lot_service.update_lot(db, current_user, lot_id, lot_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{lot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lot(
    lot_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        lot_service.delete_lot(db, current_user, lot_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{lot_id}/photos", response_model=LotPhotoRead, status_code=status.HTTP_201_CREATED)
async def upload_lot_photo(
    lot_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    content = await file.read()
    try:
        return await lot_service.upload_lot_photo(db, current_user, lot_id, content, file.content_type)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{lot_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lot_photo(
    lot_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        lot_service.delete_lot_photo(db, current_user, lot_id, photo_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
