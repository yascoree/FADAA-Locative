from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.contact_message import ContactMessageCreate, ContactMessageRead, ContactMessageUpdate
from app.services import contact_message_service
from app.services.exceptions import NotFound

router = APIRouter(prefix="/contact-messages", tags=["contact-messages"])


@router.post("/", response_model=ContactMessageRead, status_code=status.HTTP_201_CREATED)
def create_contact_message(message_in: ContactMessageCreate, db: Session = Depends(get_db)):
    """Public : soumis depuis la page de contact publique, aucun compte requis."""
    return contact_message_service.create_contact_message(db, message_in)


@router.get("/", response_model=list[ContactMessageRead])
def list_contact_messages(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    return contact_message_service.list_contact_messages(db)


@router.put("/{message_id}", response_model=ContactMessageRead)
def update_contact_message_statut(
    message_id: int,
    message_in: ContactMessageUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    try:
        return contact_message_service.update_contact_message_statut(db, message_id, message_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
