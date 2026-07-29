from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.contact_message import ContactMessageStatus


class ContactMessageCreate(BaseModel):
    prenom: str = Field(min_length=1, max_length=255)
    nom: str = Field(min_length=1, max_length=255)
    email: EmailStr
    telephone: Optional[str] = Field(default=None, max_length=30)
    sujet: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)


class ContactMessageUpdate(BaseModel):
    statut: ContactMessageStatus


class ContactMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    prenom: str
    nom: str
    email: str
    telephone: Optional[str] = None
    sujet: str
    message: str
    statut: ContactMessageStatus
    date_creation: datetime
