from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.reclamation import ReclamationStatus
from app.schemas.utilisateur import UtilisateurMini


class ReclamationCreate(BaseModel):
    sujet: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)


class ReclamationUpdate(BaseModel):
    statut: ReclamationStatus


class ReclamationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    proprietaire_id: int
    sujet: str
    message: str
    statut: ReclamationStatus
    date_creation: datetime
    date_traitement: Optional[datetime] = None
    traite_par_id: Optional[int] = None
    proprietaire: Optional[UtilisateurMini] = None
    traite_par: Optional[UtilisateurMini] = None
    # Calculé à la volée (pas une colonne) : True si acceptée mais sans message
    # échangé depuis plus de 24h — la messagerie admin est alors reverrouillée.
    expiree: bool = False
