from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class QuittanceBase(BaseModel):
    paiement_id: int = Field(gt=0)
    fichier_pdf: Optional[str] = Field(default=None, max_length=255)


class QuittanceRead(QuittanceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date_generation: datetime