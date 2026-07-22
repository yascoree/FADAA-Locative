from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BienPhotoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bien_id: int
    url: str
    date_ajout: datetime
