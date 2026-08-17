from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LotPhotoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lot_id: int
    url: str
    date_ajout: datetime
