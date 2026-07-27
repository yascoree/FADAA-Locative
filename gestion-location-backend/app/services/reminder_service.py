from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.api.deps import gestionnaire_ids_for_proprietaire
from app.core.config import settings
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance, EcheanceStatus
from app.models.lot import Lot
from app.models.notification import Notification, NotificationType
from app.services.push_service import send_push_to_user


def _bien_for_bail(db: Session, bail: Bail) -> Bien | None:
    lot = db.query(Lot).filter(Lot.id == bail.lot_id).first()
    if not lot:
        return None
    return db.query(Bien).filter(Bien.id == lot.bien_id).first()


def _notify_stakeholders(db: Session, bien: Bien, title: str, body: str, notif_type: NotificationType, reference_id: int) -> None:
    """Le propriétaire et les gestionnaires mandatés doivent aussi être avertis des
    échéances/retards sur les biens dont ils ont la charge, pas seulement le locataire."""
    stakeholder_ids = {bien.proprietaire_id, *gestionnaire_ids_for_proprietaire(db, bien.proprietaire_id)}
    for stakeholder_id in stakeholder_ids:
        send_push_to_user(db, user_id=stakeholder_id, title=title, body=body, notif_type=notif_type, reference_id=reference_id)


def _already_notified_recently(db: Session, echeance_id: int, notif_type: NotificationType, within_days: int) -> bool:
    cutoff = date.today() - timedelta(days=within_days)
    return (
        db.query(Notification)
        .filter(
            Notification.type == notif_type,
            Notification.reference_id == echeance_id,
            Notification.date_creation >= cutoff,
        )
        .first()
        is not None
    )


def send_upcoming_echeance_alerts(db: Session) -> int:
    """Alerte le locataire quand une échéance non payée arrive à
    settings.push_alert_days_before jours. Une alerte par échéance (pas de doublon)."""
    target_date = date.today() + timedelta(days=settings.push_alert_days_before)
    echeances = (
        db.query(Echeance)
        .filter(Echeance.date_echeance == target_date, Echeance.statut != EcheanceStatus.PAYE)
        .all()
    )
    sent = 0
    for echeance in echeances:
        if _already_notified_recently(db, echeance.id, NotificationType.ECHEANCE, settings.push_alert_days_before):
            continue
        bail = db.get(Bail, echeance.bail_id)
        if not bail:
            continue
        montant = echeance.montant_du if echeance.montant_du is not None else bail.loyer
        send_push_to_user(
            db,
            user_id=bail.locataire_id,
            title="Échéance à venir",
            body=f"Votre loyer de {montant} MAD est à régler le {echeance.date_echeance.strftime('%d/%m/%Y')}.",
            notif_type=NotificationType.ECHEANCE,
            reference_id=echeance.id,
        )
        bien = _bien_for_bail(db, bail)
        if bien:
            _notify_stakeholders(
                db,
                bien,
                title="Échéance à venir",
                body=f"Le loyer de {montant} MAD pour {bien.designation} est à régler le {echeance.date_echeance.strftime('%d/%m/%Y')}.",
                notif_type=NotificationType.ECHEANCE,
                reference_id=echeance.id,
            )
        sent += 1
    return sent


def send_overdue_reminders(db: Session) -> int:
    """Relance le locataire pour toute échéance impayée/partielle dont la date est
    dépassée, au plus une fois tous les settings.push_overdue_reminder_every_days jours."""
    today = date.today()
    echeances = (
        db.query(Echeance)
        .filter(
            Echeance.date_echeance < today,
            Echeance.statut.in_([EcheanceStatus.IMPAYE, EcheanceStatus.PARTIEL]),
        )
        .all()
    )
    sent = 0
    for echeance in echeances:
        if _already_notified_recently(
            db, echeance.id, NotificationType.RELANCE, settings.push_overdue_reminder_every_days
        ):
            continue
        bail = db.get(Bail, echeance.bail_id)
        if not bail:
            continue
        days_late = (today - echeance.date_echeance).days
        montant = echeance.montant_du if echeance.montant_du is not None else bail.loyer
        send_push_to_user(
            db,
            user_id=bail.locataire_id,
            title="Rappel de paiement",
            body=f"Votre loyer de {montant} MAD est en retard de {days_late} jour(s).",
            notif_type=NotificationType.RELANCE,
            reference_id=echeance.id,
        )
        bien = _bien_for_bail(db, bail)
        if bien:
            _notify_stakeholders(
                db,
                bien,
                title="Retard de paiement",
                body=f"Le loyer de {montant} MAD pour {bien.designation} est en retard de {days_late} jour(s).",
                notif_type=NotificationType.RELANCE,
                reference_id=echeance.id,
            )
        sent += 1
    return sent
