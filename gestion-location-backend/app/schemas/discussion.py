from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DiscussionBase(BaseModel):
    user_id: int = Field(gt=0)
    message: str = Field(min_length=1)
    pdf: Optional[str] = Field(default=None, max_length=255)


class DiscussionCreate(DiscussionBase):
    pass


class DiscussionUpdate(BaseModel):
    message: Optional[str] = Field(default=None, min_length=1)
    pdf: Optional[str] = Field(default=None, max_length=255)


class DiscussionRead(DiscussionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date_sent: datetime
