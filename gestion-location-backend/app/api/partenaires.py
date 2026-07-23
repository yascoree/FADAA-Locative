from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.partenaire import PartenaireCreate, PartenaireRead, PartenaireUpdate
from app.services import partenaire_service
from app.services.exceptions import BadRequest, NotFound

router = APIRouter(prefix="/partners", tags=["partners"])


@router.get("/", response_model=list[PartenaireRead])
def list_partenaires(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return partenaire_service.list_partenaires(db, skip, limit)


@router.post("/", response_model=PartenaireRead, status_code=status.HTTP_201_CREATED)
def create_partenaire(
    partenaire_in: PartenaireCreate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    return partenaire_service.create_partenaire(db, partenaire_in)


@router.get("/{partenaire_id}", response_model=PartenaireRead)
def get_partenaire(partenaire_id: int, db: Session = Depends(get_db)):
    try:
        return partenaire_service.get_partenaire(db, partenaire_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{partenaire_id}", response_model=PartenaireRead)
def update_partenaire(
    partenaire_id: int,
    partenaire_in: PartenaireUpdate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    try:
        return partenaire_service.update_partenaire(db, partenaire_id, partenaire_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete("/{partenaire_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_partenaire(
    partenaire_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    try:
        partenaire_service.delete_partenaire(db, partenaire_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{partenaire_id}/logo", response_model=PartenaireRead)
async def upload_partenaire_logo(
    partenaire_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    content = await file.read()
    try:
        return await partenaire_service.upload_partenaire_logo(db, partenaire_id, content, file.content_type)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
