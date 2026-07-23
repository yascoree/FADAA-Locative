from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.avis import AvisCreate, AvisRead, AvisUpdate
from app.services import avis_service
from app.services.exceptions import Forbidden, NotFound

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/", response_model=list[AvisRead])
def list_avis(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return avis_service.list_avis(db, current_user, skip, limit)


@router.post("/", response_model=AvisRead, status_code=status.HTTP_201_CREATED)
def create_avis(
    avis_in: AvisCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return avis_service.create_avis(db, current_user, avis_in)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get("/{avis_id}", response_model=AvisRead)
def get_avis(
    avis_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return avis_service.get_avis(db, current_user, avis_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.put("/{avis_id}", response_model=AvisRead)
def update_avis(
    avis_id: int,
    avis_in: AvisUpdate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    # The only modifiable field via this endpoint is `statut`: moderation, admin-only.
    try:
        return avis_service.update_avis(db, avis_id, avis_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete("/{avis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_avis(
    avis_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        avis_service.delete_avis(db, current_user, avis_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
