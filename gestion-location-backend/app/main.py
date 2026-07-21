from fastapi import FastAPI

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
