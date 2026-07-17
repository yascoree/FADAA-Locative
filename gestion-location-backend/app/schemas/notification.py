from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.notification import NotificationStatus, NotificationType


class NotificationBase(BaseModel):
    user_id: int
    titre: Optional[str] = Field(default=None, max_length=150)
    description: Optional[str] = None
    statut: NotificationStatus = NotificationStatus.NON_LUE
    type: Optional[NotificationType] = None


class NotificationCreate(BaseModel):
    user_id: int
    titre: Optional[str] = Field(default=None, max_length=150)
    description: Optional[str] = None
    type: Optional[NotificationType] = None


class NotificationUpdate(BaseModel):
    statut: Optional[NotificationStatus] = None


class NotificationRead(NotificationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
