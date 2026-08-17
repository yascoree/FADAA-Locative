from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.paiement import ModePaiement, PaiementStatus
from app.models.quittance import QuittanceStatus
from app.schemas.echeance import EcheanceRead
from app.schemas.utilisateur import UtilisateurMini


class PaiementBase(BaseModel):
    echeance_id: int = Field(gt=0)
    montant: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    mode_paiement: Optional[ModePaiement] = None


class PaiementCreate(PaiementBase):
    # Renseignables dès la création pour un chèque/virement, ou complétés plus
    # tard via /payments/{id}/encaisser — dans les deux cas le montant ne
    # compte dans les revenus qu'une fois l'encaissement confirmé.
    agence_bancaire: Optional[str] = Field(default=None, max_length=255)
    reference_paiement: Optional[str] = Field(default=None, max_length=255)
    justificatif: Optional[str] = Field(default=None, max_length=500)
    justificatif_nom: Optional[str] = Field(default=None, max_length=255)


class PaiementEncaissement(BaseModel):
    date_encaissement: Optional[datetime] = None
    agence_bancaire: Optional[str] = Field(default=None, max_length=255)
    reference_paiement: Optional[str] = Field(default=None, max_length=255)
    justificatif: Optional[str] = Field(default=None, max_length=500)
    justificatif_nom: Optional[str] = Field(default=None, max_length=255)


class PaiementAnnulation(BaseModel):
    motif: Optional[str] = Field(default=None, max_length=255)


class QuittanceMini(BaseModel):
    """Version allégée de QuittanceRead, définie ici (pas importée de schemas.quittance)
    pour éviter l'import circulaire paiement <-> quittance."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    statut: QuittanceStatus
    fichier_pdf: Optional[str] = None


class PaiementRead(PaiementBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date_paiement: datetime
    statut: PaiementStatus
    encaisse_par: int
    encaisseur: Optional[UtilisateurMini] = None
    annule_par: Optional[int] = None
    annulateur: Optional[UtilisateurMini] = None
    date_annulation: Optional[datetime] = None
    motif_annulation: Optional[str] = None
    echeance: Optional[EcheanceRead] = None
    quittance: Optional[QuittanceMini] = None
    encaisse: bool = True
    date_encaissement: Optional[datetime] = None
    agence_bancaire: Optional[str] = None
    reference_paiement: Optional[str] = None
    justificatif: Optional[str] = None
    justificatif_nom: Optional[str] = None