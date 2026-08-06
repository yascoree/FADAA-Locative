import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.services.bail_service import expire_overdue_baux
from app.services.invitation_client_service import expire_pending_invitations
from app.services.reminder_service import send_overdue_reminders, send_upcoming_echeance_alerts
from app.services.subscription_service import expire_overdue_subscriptions, send_subscription_expiry_warnings

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="UTC")


def _run_daily_reminders():
    db = SessionLocal()
    try:
        alerts_sent = send_upcoming_echeance_alerts(db)
        reminders_sent = send_overdue_reminders(db)
        baux_expired = expire_overdue_baux(db)
        subscription_warnings_sent = send_subscription_expiry_warnings(db)
        subscriptions_expired = expire_overdue_subscriptions(db)
        invitations_expired = expire_pending_invitations(db)
        logger.info(
            "Rappels quotidiens : %s alerte(s) d'échéance, %s relance(s) d'impayé, %s bail(aux) expiré(s), "
            "%s alerte(s) d'abonnement bientôt expiré, %s abonnement(s) expiré(s), %s invitation(s) client expirée(s).",
            alerts_sent,
            reminders_sent,
            baux_expired,
            subscription_warnings_sent,
            subscriptions_expired,
            invitations_expired,
        )
    finally:
        db.close()


def start_scheduler():
    if scheduler.running:
        return
    # Tourne chaque jour à 8h UTC : alertes d'échéance à venir + relances d'impayés.
    scheduler.add_job(_run_daily_reminders, "cron", hour=8, minute=0, id="daily_reminders", replace_existing=True)
    scheduler.start()


def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
