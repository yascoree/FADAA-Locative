from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.invitation_client import InvitationClientStatus
from app.schemas.agence import AgenceMini
from app.schemas.utilisateur import UtilisateurMini


class InvitationClientCreate(BaseModel):
    # Volontairement rien d'autre : pas de portée ni de permissions proposées
    # ici — l'invitation n'établit que la relation, le propriétaire configure
    # lui-même l'accès après acceptation (voir app.models.invitation_client).
    email: EmailStr = Field(max_length=255)


class InvitationClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    statut: InvitationClientStatus
    created_at: datetime
    responded_at: Optional[datetime] = None
    agence: AgenceMini
    proprietaire: UtilisateurMini


class InvitationClientCreateResult(BaseModel):
    invitation: InvitationClientRead
    # Présent seulement en mode test (SMTP non configuré) — voir email_service.send_email.
    invite_link: Optional[str] = None
