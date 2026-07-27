from sqlalchemy.orm import Session

from app.models.demande_demo import DemandeDemo
from app.models.notification import NotificationType
from app.schemas.demande_demo import DemandeDemoCreate, DemandeDemoUpdate
from app.services.exceptions import NotFound
from app.services.push_service import notify_admins


def create_demande_demo(db: Session, demande_in: DemandeDemoCreate) -> DemandeDemo:
    demande = DemandeDemo(
        nom=demande_in.nom,
        email=demande_in.email,
        telephone=demande_in.telephone,
        date_souhaitee=demande_in.date_souhaitee,
        message=demande_in.message,
    )
    db.add(demande)
    db.commit()
    db.refresh(demande)

    notify_admins(
        db,
        title="Nouvelle demande de démo",
        body=f"{demande.nom} souhaite planifier une démo.",
        notif_type=NotificationType.DEMANDE_DEMO,
        reference_id=demande.id,
    )

    return demande


def list_demandes_demo(db: Session) -> list[DemandeDemo]:
    return db.query(DemandeDemo).order_by(DemandeDemo.date_creation.desc()).all()


def update_demande_demo_statut(db: Session, demande_id: int, demande_in: DemandeDemoUpdate) -> DemandeDemo:
    demande = db.get(DemandeDemo, demande_id)
    if not demande:
        raise NotFound("Demande not found")
    demande.statut = demande_in.statut
    db.commit()
    db.refresh(demande)
    return demande
