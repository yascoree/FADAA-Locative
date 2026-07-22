import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.services.reminder_service import send_overdue_reminders, send_upcoming_echeance_alerts

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="UTC")


def _run_daily_reminders():
    db = SessionLocal()
    try:
        alerts_sent = send_upcoming_echeance_alerts(db)
        reminders_sent = send_overdue_reminders(db)
        logger.info("Rappels quotidiens : %s alerte(s) d'échéance, %s relance(s) d'impayé envoyées.", alerts_sent, reminders_sent)
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
