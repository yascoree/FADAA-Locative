from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.utilisateur import UtilisateurMini


class DiscussionCreate(BaseModel):
    destinataire_id: int = Field(gt=0)
    message: str = Field(min_length=1)
    pdf: Optional[str] = Field(default=None, max_length=255)


class DiscussionUpdate(BaseModel):
    message: Optional[str] = Field(default=None, min_length=1)
    pdf: Optional[str] = Field(default=None, max_length=255)


class DiscussionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    destinataire_id: Optional[int] = None
    message: str
    pdf: Optional[str] = None
    date_sent: datetime
    user: Optional[UtilisateurMini] = None
    destinataire: Optional[UtilisateurMini] = None
