from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.utilisateur import UtilisateurMini


class HistoriqueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    module: str
    action: str
    element_id: Optional[int] = None
    element_label: Optional[str] = None
    created_at: datetime
    utilisateur: Optional[UtilisateurMini] = None
