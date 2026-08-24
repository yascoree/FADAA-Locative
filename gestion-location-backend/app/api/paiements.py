from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.paiement import PaiementAnnulation, PaiementCreate, PaiementEncaissement, PaiementRead
from app.services import paiement_service
from app.services.exceptions import BadRequest, Forbidden, NotFound, PaymentRequired

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/", response_model=list[PaiementRead])
def list_paiements(
    skip: int = 0,
    limit: int = 100,
    proprietaire_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return paiement_service.list_paiements(db, current_user, skip, limit, proprietaire_id=proprietaire_id)
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/", response_model=PaiementRead, status_code=status.HTTP_201_CREATED)
def create_paiement(
    paiement_in: PaiementCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return paiement_service.create_paiement(db, current_user, paiement_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except PaymentRequired as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/justificatifs")
async def upload_justificatif(
    file: UploadFile = File(...),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Doit être déclaré avant /{paiement_id} pour ne pas être intercepté par cette route."""
    content = await file.read()
    try:
        return paiement_service.upload_justificatif(current_user, content, file.content_type, file.filename)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{paiement_id}", response_model=PaiementRead)
def get_paiement(
    paiement_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return paiement_service.get_paiement(db, current_user, paiement_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.delete("/{paiement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_paiement(
    paiement_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        paiement_service.delete_paiement(db, current_user, paiement_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{paiement_id}/annuler", response_model=PaiementRead)
def annuler_paiement(
    paiement_id: int,
    annulation_in: PaiementAnnulation | None = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    motif = annulation_in.motif if annulation_in else None
    try:
        return paiement_service.annuler_paiement(db, current_user, paiement_id, motif)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{paiement_id}/encaisser", response_model=PaiementRead)
def encaisser_paiement(
    paiement_id: int,
    encaissement_in: PaiementEncaissement | None = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return paiement_service.confirmer_encaissement(
            db, current_user, paiement_id, encaissement_in or PaiementEncaissement()
        )
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
