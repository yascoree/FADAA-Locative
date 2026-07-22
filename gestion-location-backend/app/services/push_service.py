import logging
from typing import Optional

import firebase_admin
from firebase_admin import credentials, messaging
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.fcm_token import FCMToken
from app.models.notification import Notification, NotificationType

logger = logging.getLogger(__name__)

_firebase_app = None
_firebase_init_attempted = False


def _get_firebase_app():
    """Initialise Firebase une seule fois (lazy). Retourne None si aucune clé de
    compte de service n'est configurée ou si l'initialisation échoue — dans ce
    cas les push sont simplement sautés, les notifications in-app restent créées."""
    global _firebase_app, _firebase_init_attempted
    if _firebase_init_attempted:
        return _firebase_app
    _firebase_init_attempted = True

    if not settings.firebase_credentials_path:
        logger.warning("FIREBASE_CREDENTIALS_PATH non configuré — push FCM désactivés (in-app uniquement).")
        return None
    try:
        cred = credentials.Certificate(settings.firebase_credentials_path)
        _firebase_app = firebase_admin.initialize_app(cred)
    except Exception:
        logger.exception("Échec d'initialisation de Firebase — push FCM désactivés.")
        _firebase_app = None
    return _firebase_app


def send_push_to_user(
    db: Session,
    user_id: int,
    title: str,
    body: str,
    notif_type: Optional[NotificationType] = None,
    reference_id: Optional[int] = None,
) -> Notification:
    """Crée toujours la notification in-app (cloche) ; envoie en plus un push FCM
    si Firebase est configuré et que l'utilisateur a au moins un appareil enregistré."""
    notification = Notification(
        user_id=user_id,
        titre=title,
        description=body,
        type=notif_type,
        reference_id=reference_id,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    app = _get_firebase_app()
    if not app:
        return notification

    tokens = [t.token for t in db.query(FCMToken).filter(FCMToken.user_id == user_id).all()]
    if not tokens:
        return notification

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        tokens=tokens,
    )
    try:
        response = messaging.send_each_for_multicast(message, app=app)
    except Exception:
        logger.exception("Échec d'envoi du push FCM pour l'utilisateur %s", user_id)
        return notification

    # Nettoie les jetons invalides/désinstallés pour ne pas les retenter indéfiniment.
    invalid_tokens = [tokens[i] for i, r in enumerate(response.responses) if not r.success]
    if invalid_tokens:
        db.query(FCMToken).filter(FCMToken.token.in_(invalid_tokens)).delete(synchronize_session=False)
        db.commit()

    return notification
