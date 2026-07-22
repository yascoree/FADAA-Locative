from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FCMTokenCreate(BaseModel):
    token: str = Field(min_length=1, max_length=255)


class FCMTokenRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    token: str
    date_creation: datetime
