from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.mandat import MandatRead
from app.schemas.utilisateur import UtilisateurRead


class GestionnaireInviteCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=255)
    # None = mandat sur tous les biens du propriétaire ; un id précis restreint
    # l'accès du nouveau gestionnaire à ce seul bien.
    bien_id: Optional[int] = Field(default=None, gt=0)


class GestionnaireInviteRead(BaseModel):
    utilisateur: UtilisateurRead
    mandat: MandatRead
    # Présent seulement en mode test (SMTP non configuré) : lien à transmettre
    # manuellement au gestionnaire pour qu'il choisisse son mot de passe.
    invite_link: Optional[str] = None
