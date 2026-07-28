import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Sends via SMTP if configured. If not, logs the content and returns False so
    the caller can fall back to test-mode behavior (e.g. surfacing a reset link
    directly in the API response instead of pretending an email went out)."""
    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        logger.warning("SMTP not configured — email not sent (test mode). Subject: %s, to: %s", subject, to)
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email or settings.smtp_username
    message["To"] = to
    message.set_content("Ouvrez ce message dans un client compatible HTML.")
    message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False
