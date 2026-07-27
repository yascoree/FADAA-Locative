import json

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.security import decode_access_token
from app.database import SessionLocal
from app.models.historique import Historique

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


class HistoriqueMiddleware(BaseHTTPMiddleware):
    """Journalise chaque action authentifiée (créer/modifier/supprimer/consulter
    une ressource précise) dans la table `historiques`, à partir de la méthode
    HTTP et du chemin de la requête — pas besoin d'instrumenter chaque service
    un par un, tout nouvel endpoint est couvert automatiquement."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        path = request.url.path
        if path == "/" or path.startswith(EXCLUDED_PREFIXES):
            return response
        if response.status_code >= 400:
            return response

        action = METHOD_ACTION.get(request.method)
        if not action:
            return response

        segments = [s for s in path.split("/") if s]
        if not segments:
            return response
        module = segments[0]

        if action == "GET" and module in POLLING_MODULES:
            return response

        element_id = next((int(s) for s in reversed(segments[1:]) if s.isdigit()), None)

        body = None
        if action == "CREATE" and element_id is None:
            # Le nouvel id n'est connu qu'à la création : on lit la réponse pour le
            # récupérer, puis on la reconstruit puisque le flux ne se lit qu'une fois.
            body = b"".join([chunk async for chunk in response.body_iterator])
            try:
                data = json.loads(body)
                if isinstance(data, dict) and isinstance(data.get("id"), int):
                    element_id = data["id"]
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass
            response = Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        if action == "GET" and element_id is None:
            # Liste complète (ex: GET /properties/) : pas assez spécifique pour
            # l'audit, et potentiellement fréquente — on ne trace que l'accès à
            # une ressource précise (GET /properties/12).
            return response

        auth_header = request.headers.get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            return response
        try:
            payload = decode_access_token(auth_header.split(" ", 1)[1])
            user_id = int(payload["sub"])
        except Exception:
            return response

        db = SessionLocal()
        try:
            db.add(Historique(user_id=user_id, module=module, action=action, element_id=element_id))
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

        return response
