from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.utilisateur import UtilisateurMini


class DiscussionCreate(BaseModel):
    destinataire_id: int = Field(gt=0)
    message: str = Field(default="", max_length=4000)
    piece_jointe: Optional[str] = Field(default=None, max_length=255)
    piece_jointe_nom: Optional[str] = Field(default=None, max_length=255)
    piece_jointe_type: Optional[str] = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def check_has_content(self):
        if not self.message.strip() and not self.piece_jointe:
            raise ValueError("A message must have text or an attachment")
        return self


class DiscussionUpdate(BaseModel):
    message: Optional[str] = Field(default=None, min_length=1, max_length=4000)


class DiscussionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    destinataire_id: Optional[int] = None
    message: str
    piece_jointe: Optional[str] = None
    piece_jointe_nom: Optional[str] = None
    piece_jointe_type: Optional[str] = None
    date_sent: datetime
    user: Optional[UtilisateurMini] = None
    destinataire: Optional[UtilisateurMini] = None
