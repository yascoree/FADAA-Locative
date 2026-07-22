from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.mandat import MandatStatus
from app.schemas.utilisateur import UtilisateurMini


class MandatBase(BaseModel):
    gestionnaire_id: int = Field(gt=0)
    proprietaire_id: int = Field(gt=0)
    date_debut: Optional[date] = None
    statut: Optional[MandatStatus] = None

    @model_validator(mode="after")
    def check_distinct_parties(self):
        if self.gestionnaire_id == self.proprietaire_id:
            raise ValueError("gestionnaire_id and proprietaire_id must be different")
        return self


class MandatCreate(MandatBase):
    pass


class MandatUpdate(BaseModel):
    statut: Optional[MandatStatus] = None


class MandatRead(MandatBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime
    gestionnaire: Optional[UtilisateurMini] = None
    proprietaire: Optional[UtilisateurMini] = None