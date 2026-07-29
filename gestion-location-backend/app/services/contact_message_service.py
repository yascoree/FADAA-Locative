from sqlalchemy.orm import Session

from app.models.contact_message import ContactMessage
from app.models.notification import NotificationType
from app.schemas.contact_message import ContactMessageCreate, ContactMessageUpdate
from app.services.exceptions import NotFound
from app.services.push_service import notify_admins


def create_contact_message(db: Session, message_in: ContactMessageCreate) -> ContactMessage:
    message = ContactMessage(
        prenom=message_in.prenom,
        nom=message_in.nom,
        email=message_in.email,
        telephone=message_in.telephone,
        sujet=message_in.sujet,
        message=message_in.message,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    notify_admins(
        db,
        title="Nouveau message de contact",
        body=f"{message.prenom} {message.nom} — {message.sujet}",
        notif_type=NotificationType.CONTACT_MESSAGE,
        reference_id=message.id,
    )

    return message


def list_contact_messages(db: Session) -> list[ContactMessage]:
    return db.query(ContactMessage).order_by(ContactMessage.date_creation.desc()).all()


def update_contact_message_statut(db: Session, message_id: int, message_in: ContactMessageUpdate) -> ContactMessage:
    message = db.get(ContactMessage, message_id)
    if not message:
        raise NotFound("Message not found")
    message.statut = message_in.statut
    db.commit()
    db.refresh(message)
    return message
