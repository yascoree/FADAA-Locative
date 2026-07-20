from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import can_manage_proprietaire, get_current_user, managed_proprietaire_ids
from app.database import get_db
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.paiement import Paiement
from app.models.quittance import Quittance
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.quittance import QuittanceRead

router = APIRouter(prefix="/receipts", tags=["receipts"])


def _bail_and_bien(db: Session, quittance: Quittance):
    paiement = db.get(Paiement, quittance.paiement_id)
    echeance = db.get(Echeance, paiement.echeance_id)
    bail = db.get(Bail, echeance.bail_id)
    lot = db.get(Lot, bail.lot_id)
    bien = db.get(Bien, lot.bien_id)
    return bail, bien


def _can_view_quittance(db: Session, user: Utilisateur, quittance: Quittance) -> bool:
    bail, bien = _bail_and_bien(db, quittance)
    if user.role == UtilisateurRole.LOCATAIRE and user.id == bail.locataire_id:
        return True
    return bool(bien) and can_manage_proprietaire(db, user, bien.proprietaire_id)


@router.get("/", response_model=list[QuittanceRead])
def list_quittances(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Quittance)
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = (
            query.join(Paiement, Paiement.id == Quittance.paiement_id)
            .join(Echeance, Echeance.id == Paiement.echeance_id)
            .join(Bail, Bail.id == Echeance.bail_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id == current_user.id)
        )
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = managed_proprietaire_ids(db, current_user.id)
        if not ids:
            return []
        query = (
            query.join(Paiement, Paiement.id == Quittance.paiement_id)
            .join(Echeance, Echeance.id == Paiement.echeance_id)
            .join(Bail, Bail.id == Echeance.bail_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id.in_(ids))
        )
    elif current_user.role == UtilisateurRole.LOCATAIRE:
        query = (
            query.join(Paiement, Paiement.id == Quittance.paiement_id)
            .join(Echeance, Echeance.id == Paiement.echeance_id)
            .join(Bail, Bail.id == Echeance.bail_id)
            .filter(Bail.locataire_id == current_user.id)
        )
    return query.offset(skip).limit(limit).all()


@router.get("/{quittance_id}", response_model=QuittanceRead)
def get_quittance(
    quittance_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    quittance = db.get(Quittance, quittance_id)
    if not quittance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    if not _can_view_quittance(db, current_user, quittance):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this receipt")
    return quittance


@router.get("/{quittance_id}/download")
def download_quittance(
    quittance_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    quittance = db.get(Quittance, quittance_id)
    if not quittance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    if not _can_view_quittance(db, current_user, quittance):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this receipt")

    if not quittance.fichier_pdf or not Path(quittance.fichier_pdf).is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF file not available")

    return FileResponse(
        quittance.fichier_pdf, media_type="application/pdf", filename=f"quittance_{quittance.id}.pdf"
    )
