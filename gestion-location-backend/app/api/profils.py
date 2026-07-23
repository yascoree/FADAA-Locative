from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.profil import ProfilCreate, ProfilRead, ProfilUpdate
from app.services import profil_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.post("/", response_model=ProfilRead, status_code=status.HTTP_201_CREATED)
def create_profil(
    profil_in: ProfilCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return profil_service.create_profil(db, current_user, profil_in)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{utilisateur_id}", response_model=ProfilRead)
def get_profil(
    utilisateur_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return profil_service.get_profil(db, current_user, utilisateur_id)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{utilisateur_id}", response_model=ProfilRead)
def update_profil(
    utilisateur_id: int,
    profil_in: ProfilUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return profil_service.update_profil(db, current_user, utilisateur_id, profil_in)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{utilisateur_id}/photo", response_model=ProfilRead, status_code=status.HTTP_201_CREATED)
async def upload_profil_photo(
    utilisateur_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    content = await file.read()
    try:
        return profil_service.upload_profil_photo(db, current_user, utilisateur_id, content, file.content_type)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{utilisateur_id}/photo", response_model=ProfilRead)
def delete_profil_photo(
    utilisateur_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return profil_service.delete_profil_photo(db, current_user, utilisateur_id)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
