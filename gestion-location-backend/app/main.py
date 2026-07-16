from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Bienvenue sur l'API Gestion Location"}