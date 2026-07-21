from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth,
    avis,
    baux,
    biens,
    categories,
    discussions,
    echeances,
    locataires,
    lots,
    mandats,
    notifications,
    paiements,
    partenaires,
    permissions,
    profils,
    quittances,
    subscription_plans,
    subscriptions,
    utilisateurs,
)

app = FastAPI(title="Gestion Location API")

# Dev/test uniquement : les pages de test HTML statiques (fichier local ou autre
# origine) doivent pouvoir appeler l'API. Bearer token, pas de cookies -> pas
# besoin d'allow_credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(utilisateurs.router)
app.include_router(subscription_plans.router)
app.include_router(subscriptions.router)
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
app.include_router(discussions.router)
app.include_router(avis.router)
app.include_router(partenaires.router)


@app.get("/")
def root():
    return {"message": "Bienvenue sur l'API Gestion Location"}
