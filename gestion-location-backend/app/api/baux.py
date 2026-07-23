from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_gestion
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.bail import BailCreate, BailRead, BailUpdate
from app.services import bail_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

router = APIRouter(prefix="/leases", tags=["leases"])


@router.get("/", response_model=list[BailRead])
def list_baux(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return bail_service.list_baux(db, current_user, skip, limit)


@router.post("/", response_model=BailRead, status_code=status.HTTP_201_CREATED)
def create_bail(
    bail_in: BailCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_gestion),
):
    try:
        return bail_service.create_bail(db, current_user, bail_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{bail_id}", response_model=BailRead)
def get_bail(
    bail_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return bail_service.get_bail(db, current_user, bail_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.put("/{bail_id}", response_model=BailRead)
def update_bail(
    bail_id: int,
    bail_in: BailUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return bail_service.update_bail(db, current_user, bail_id, bail_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.delete("/{bail_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bail(
    bail_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        bail_service.delete_bail(db, current_user, bail_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
