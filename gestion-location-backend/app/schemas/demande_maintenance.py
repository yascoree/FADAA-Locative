from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.demande_maintenance import DemandeMaintenanceStatus
from app.schemas.bail import BailRead
from app.schemas.utilisateur import UtilisateurMini


class DemandeMaintenanceCreate(BaseModel):
    bail_id: int = Field(gt=0)
    titre: str = Field(max_length=150)
    description: str


class DemandeMaintenanceUpdate(BaseModel):
    statut: Optional[DemandeMaintenanceStatus] = None
    reponse: Optional[str] = None


class DemandeMaintenanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bail_id: int
    locataire_id: int
    titre: str
    description: str
    statut: DemandeMaintenanceStatus
    reponse: Optional[str] = None
    traite_par_id: Optional[int] = None
    traite_par: Optional[UtilisateurMini] = None
    locataire: Optional[UtilisateurMini] = None
    bail: Optional[BailRead] = None
    date_creation: datetime
    date_traitement: Optional[datetime] = None
