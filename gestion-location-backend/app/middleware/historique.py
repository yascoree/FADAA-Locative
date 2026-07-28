import enum
import json
from datetime import date, datetime
from decimal import Decimal

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.security import decode_access_token
from app.database import SessionLocal
from app.models.historique import Historique
from app.services.historique_service import MODULE_LABEL_MAP

METHOD_ACTION = {
    "POST": "CREATE",
    "PUT": "UPDATE",
    "PATCH": "UPDATE",
    "DELETE": "DELETE",
    "GET": "GET",
}

# Le frontend interroge ces modules en continu (cloche de notifications, fil de
# discussion) : journaliser chaque GET y noierait la table pour un signal quasi
# nul. Les CREATE/UPDATE/DELETE sur ces mêmes modules restent journalisés.
POLLING_MODULES = {"notifications", "discussions"}

EXCLUDED_PREFIXES = ("/docs", "/openapi.json", "/redoc", "/uploads", "/auth")

# Routes qui, bien que génériques dans leur méthode HTTP (POST/PUT/DELETE), portent
# une intention métier précise — on remplace l'action générique (CREATE/UPDATE/
# DELETE) par ce libellé explicite. Clé : (méthode HTTP, module, dernier segment
# littéral du chemin — None si ce segment est l'id de la ressource elle-même).
BUSINESS_ACTIONS = {
    ("POST", "payments", "annuler"): "CANCEL_PAYMENT",
    ("POST", "receipts", "annuler"): "CANCEL_RECEIPT",
    ("DELETE", "mandates", None): "REVOKE_MANDATE",
    ("PUT", "mandates", "permissions"): "ASSIGN_PERMISSION",
    ("POST", "users", "activate"): "ACTIVATE_USER",
    ("POST", "users", "deactivate"): "DEACTIVATE_USER",
}

# Détection des actions métier qui n'ont pas de route dédiée mais se traduisent
# par la transition d'un champ de statut sur une UPDATE générique (ex: résilier
# un bail se fait via PUT /leases/{id} avec statut=RESILIE, pas un endpoint à part).
STATUS_TRANSITIONS = {
    "leases": {"field": "statut", "to": {"RESILIE": "TERMINATE_BAIL", "EXPIRE": "TERMINATE_BAIL"}},
}

# Colonnes à ne jamais journaliser même quand le module est autrement audité.
SENSITIVE_FIELDS = {"mot_de_passe"}


def _serialize_row(obj) -> dict:
    row = {}
    for column in obj.__table__.columns:
        if column.name in SENSITIVE_FIELDS:
            continue
        value = getattr(obj, column.name)
        if isinstance(value, (datetime, date)):
            value = value.isoformat()
        elif isinstance(value, enum.Enum):
            value = value.name
        elif isinstance(value, Decimal):
            value = float(value)
        row[column.name] = value
    return row


def _snapshot(db, module: str, element_id: int) -> dict | None:
    mapping = MODULE_LABEL_MAP.get(module)
    if not mapping or element_id is None:
        return None
    model, _ = mapping
    obj = db.get(model, element_id)
    return _serialize_row(obj) if obj is not None else None


class HistoriqueMiddleware(BaseHTTPMiddleware):
    """Journalise chaque action authentifiée (créer/modifier/supprimer/consulter
    une ressource précise) dans la table `historiques`, à partir de la méthode
    HTTP et du chemin de la requête — pas besoin d'instrumenter chaque service
    un par un, tout nouvel endpoint est couvert automatiquement."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path == "/" or path.startswith(EXCLUDED_PREFIXES):
            return await call_next(request)

        segments = [s for s in path.split("/") if s]
        if not segments:
            return await call_next(request)
        module = segments[0]

        base_action = METHOD_ACTION.get(request.method)
        if not base_action:
            return await call_next(request)
        if base_action == "GET" and module in POLLING_MODULES:
            return await call_next(request)

        # Le premier segment numérique après le module correspond toujours à la
        # ressource identifiée par ce module (ex: /properties/15/photos/8 -> 15,
        # la propriété — pas 8, la photo imbriquée). Un scan en sens inverse
        # renverrait l'id le plus profond, ce qui désynchronise module/element_id
        # dès qu'un chemin a plus d'un id (cf. photos, pièces jointes).
        element_id = next((int(s) for s in segments[1:] if s.isdigit()), None)
        trailing = segments[-1] if segments and not segments[-1].isdigit() else None
        business_key = (request.method, module, trailing)
        action = BUSINESS_ACTIONS.get(business_key, base_action)

        if base_action == "GET" and element_id is None:
            # Liste complète (ex: GET /properties/) : pas assez spécifique pour
            # l'audit, et potentiellement fréquente — on ne trace que l'accès à
            # une ressource précise (GET /properties/12).
            return await call_next(request)

        auth_header = request.headers.get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            return await call_next(request)
        try:
            payload = decode_access_token(auth_header.split(" ", 1)[1])
            user_id = int(payload["sub"])
        except Exception:
            return await call_next(request)

        old_values = None
        snapshot_before = (
            element_id is not None
            and module in MODULE_LABEL_MAP
            and (base_action in ("UPDATE", "DELETE") or business_key in BUSINESS_ACTIONS)
        )
        if snapshot_before:
            snap_db = SessionLocal()
            try:
                old_values = _snapshot(snap_db, module, element_id)
            except Exception:
                old_values = None
            finally:
                snap_db.close()

        response = await call_next(request)

        if response.status_code >= 400:
            return response

        new_values = None
        if base_action == "CREATE" and element_id is None:
            # Le nouvel id n'est connu qu'à la création : on lit la réponse pour le
            # récupérer, puis on la reconstruit puisque le flux ne se lit qu'une fois.
            body = b"".join([chunk async for chunk in response.body_iterator])
            try:
                data = json.loads(body)
                if isinstance(data, dict):
                    if isinstance(data.get("id"), int):
                        element_id = data["id"]
                    new_values = data
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass
            response = Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        db = SessionLocal()
        try:
            if snapshot_before:
                try:
                    new_values = _snapshot(db, module, element_id)
                except Exception:
                    new_values = None

            if action == "UPDATE" and module in STATUS_TRANSITIONS and old_values and new_values:
                cfg = STATUS_TRANSITIONS[module]
                new_status = new_values.get(cfg["field"])
                if new_status in cfg["to"] and old_values.get(cfg["field"]) != new_status:
                    action = cfg["to"][new_status]

            db.add(
                Historique(
                    user_id=user_id,
                    module=module,
                    action=action,
                    element_id=element_id,
                    old_values=old_values,
                    new_values=new_values,
                )
            )
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

        return response
