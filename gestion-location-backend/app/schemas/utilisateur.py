from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.utilisateur import StatutCompte, UtilisateurRole


class UtilisateurBase(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=255)
    role: UtilisateurRole
    statut_compte: StatutCompte = StatutCompte.ACTIF
    cree_par_id: Optional[int] = Field(default=None, gt=0)


class UtilisateurCreate(UtilisateurBase):
    mot_de_passe: str = Field(min_length=8, max_length=128)


class UtilisateurUpdate(BaseModel):
    nom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    prenom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[EmailStr] = Field(default=None, max_length=255)
    role: Optional[UtilisateurRole] = None
    statut_compte: Optional[StatutCompte] = None
    mot_de_passe: Optional[str] = Field(default=None, min_length=8, max_length=128)


class UtilisateurRead(UtilisateurBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date_creation: datetime
