from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import (
    auth,
    avis,
    baux,
    biens,
    categories,
    contact_messages,
    demandes_demo,
    discussions,
    echeances,
    fcm_tokens,
    historique,
    locataires,
    lots,
    mandats,
    notifications,
    paiements,
    partenaires,
    permissions,
    plan_change_requests,
    profils,
    quittances,
    reclamations,
    stats,
    subscription_plans,
    subscriptions,
    utilisateurs,
)
from app.middleware.historique import HistoriqueMiddleware
from app.scheduler import shutdown_scheduler, start_scheduler

app = FastAPI(title="Gestion Location API")

# Journalise chaque action authentifiée (créer/modifier/supprimer/consulter une
# ressource précise) dans la table `historiques` — voir app/middleware/historique.py.
app.add_middleware(HistoriqueMiddleware)

# Dev/test uniquement : les pages de test HTML statiques (fichier local ou autre
# origine) doivent pouvoir appeler l'API. Bearer token, pas de cookies -> pas
# besoin d'allow_credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


app.include_router(auth.router)
app.include_router(utilisateurs.router)
app.include_router(subscription_plans.router)
app.include_router(subscriptions.router)
app.include_router(plan_change_requests.router)
app.include_router(profils.router)
app.include_router(locataires.router)
app.include_router(categories.router)
app.include_router(biens.router)
app.include_router(lots.router)
app.include_router(baux.router)
app.include_router(echeances.router)
app.include_router(paiements.router)
app.include_router(quittances.router)
app.include_router(mandats.router)
app.include_router(permissions.router)
app.include_router(notifications.router)
app.include_router(fcm_tokens.router)
app.include_router(discussions.router)
app.include_router(avis.router)
app.include_router(partenaires.router)
app.include_router(reclamations.router)
app.include_router(demandes_demo.router)
app.include_router(contact_messages.router)
app.include_router(stats.router)
app.include_router(historique.router)


@app.on_event("startup")
def _on_startup():
    start_scheduler()


@app.on_event("shutdown")
def _on_shutdown():
    shutdown_scheduler()


@app.get("/")
def root():
    return {"message": "Bienvenue sur l'API Gestion Location"}
