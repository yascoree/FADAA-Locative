from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.agence_membre import AgenceMembreStatus, RoleAgence
from app.schemas.utilisateur import UtilisateurMini


class AgenceMini(BaseModel):
    """Identité minimale d'une agence, pour l'afficher en tant que partie d'un
    Mandat (voir MandatRead) sans exposer la liste complète de ses membres."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nom: str


class AgenceRead(AgenceMini):
    created_at: datetime


class AgenceMembreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    agence_id: int
    role_agence: RoleAgence
    statut: AgenceMembreStatus
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    utilisateur: Optional[UtilisateurMini] = None


class AgenceMembreInviteCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=255)
    role_agence: RoleAgence = RoleAgence.MEMBRE


class AgenceMembreInviteRead(BaseModel):
    membre: AgenceMembreRead
    invite_link: Optional[str] = None


class AgenceMembreUpdate(BaseModel):
    role_agence: RoleAgence
    # Ne peuvent être modifiés que tant que le compte est INVITE_EN_ATTENTE (voir
    # agence_service.update_agence_member) — l'email n'est volontairement jamais
    # éditable ici : c'est l'identifiant de connexion, en changer sans passer par
    # le titulaire du compte serait une porte ouverte à un détournement de compte.
    nom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    prenom: Optional[str] = Field(default=None, min_length=1, max_length=100)
