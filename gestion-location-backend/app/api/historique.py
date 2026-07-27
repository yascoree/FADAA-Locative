from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.historique import HistoriqueRead
from app.services import historique_service

router = APIRouter(prefix="/historique", tags=["historique"])


@router.get("/", response_model=list[HistoriqueRead])
def list_historique(
    skip: int = 0,
    limit: int = 200,
    module: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    return historique_service.list_historique(db, skip, limit, module, action, user_id)
