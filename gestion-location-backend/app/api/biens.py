from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_gestion
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.bien import BienCreate, BienRead, BienUpdate
from app.schemas.bien_photo import BienPhotoRead
from app.services import bien_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("/", response_model=list[BienRead])
def list_biens(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return bien_service.list_biens(db, current_user, skip, limit)


@router.post("/", response_model=BienRead, status_code=status.HTTP_201_CREATED)
def create_bien(
    bien_in: BienCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_gestion),
):
    try:
        return bien_service.create_bien(db, current_user, bien_in)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get("/{bien_id}", response_model=BienRead)
def get_bien(
    bien_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return bien_service.get_bien(db, current_user, bien_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.put("/{bien_id}", response_model=BienRead)
def update_bien(
    bien_id: int,
    bien_in: BienUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return bien_service.update_bien(db, current_user, bien_id, bien_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.delete("/{bien_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bien(
    bien_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        bien_service.delete_bien(db, current_user, bien_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/{bien_id}/photos", response_model=BienPhotoRead, status_code=status.HTTP_201_CREATED)
async def upload_bien_photo(
    bien_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    content = await file.read()
    try:
        return await bien_service.upload_bien_photo(db, current_user, bien_id, content, file.content_type)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{bien_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bien_photo(
    bien_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        bien_service.delete_bien_photo(db, current_user, bien_id, photo_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
