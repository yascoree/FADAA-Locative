from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.mandat import MandatStatus
from app.schemas.agence import AgenceMini
from app.schemas.bien import BienMini
from app.schemas.utilisateur import UtilisateurMini


class MandatBase(BaseModel):
    agence_id: int = Field(gt=0)
    proprietaire_id: int = Field(gt=0)
    # None = mandat sur tous les biens du propriétaire ; un id précis restreint le
    # mandat à ce seul bien.
    bien_id: Optional[int] = Field(default=None, gt=0)
    date_debut: Optional[date] = None
    statut: Optional[MandatStatus] = None


class MandatCreate(MandatBase):
    pass


class MandatUpdate(BaseModel):
    statut: Optional[MandatStatus] = None


class MandatRead(MandatBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int
    agence: Optional[AgenceMini] = None
    proprietaire: Optional[UtilisateurMini] = None
    createur: Optional[UtilisateurMini] = None
    bien: Optional[BienMini] = None