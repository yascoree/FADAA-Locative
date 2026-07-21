from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.permission import Permission
from app.schemas.permission import PermissionRead

router = APIRouter(prefix="/permissions", tags=["permissions"])

# Catalogue fixe (voir la migration 64b8063d2060) : pas de création/modification
# via l'API, seulement une lecture pour permettre à l'interface propriétaire
# d'afficher la liste des permissions accordables à un gestionnaire.


@router.get("/", response_model=list[PermissionRead])
def list_permissions(db: Session = Depends(get_db), _current_user=Depends(get_current_user)):
    return db.query(Permission).order_by(Permission.id).all()
