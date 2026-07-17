from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.auth import RefreshRequest, Token
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UtilisateurRead, status_code=status.HTTP_201_CREATED)
def register(utilisateur_in: UtilisateurCreate, db: Session = Depends(get_db)):
    """Inscription publique : crée toujours un compte Propriétaire."""
    existing_utilisateur = db.query(Utilisateur).filter(Utilisateur.email == utilisateur_in.email).first()
    if existing_utilisateur:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    utilisateur = Utilisateur(
        nom=utilisateur_in.nom,
        prenom=utilisateur_in.prenom,
        email=utilisateur_in.email,
        mot_de_passe=hash_password(utilisateur_in.mot_de_passe),
        role=UtilisateurRole.PROPRIETAIRE,
        statut_compte=utilisateur_in.statut_compte,
        cree_par_id=utilisateur_in.cree_par_id,
    )
    db.add(utilisateur)
    db.commit()
    db.refresh(utilisateur)
    return utilisateur


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    utilisateur = db.query(Utilisateur).filter(Utilisateur.email == form_data.username).first()
    if not utilisateur or not verify_password(form_data.password, utilisateur.mot_de_passe):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(utilisateur.id)})
    refresh_token = create_refresh_token(data={"sub": str(utilisateur.id)})
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=Token)
def refresh(refresh_in: RefreshRequest, db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
    )
    try:
        payload = decode_access_token(refresh_in.refresh_token)
    except JWTError:
        raise credentials_exception

    if payload.get("type") != "refresh":
        raise credentials_exception

    utilisateur_id = payload.get("sub")
    if utilisateur_id is None or db.get(Utilisateur, int(utilisateur_id)) is None:
        raise credentials_exception

    access_token = create_access_token(data={"sub": utilisateur_id})
    return Token(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(current_user: Utilisateur = Depends(get_current_user)):
    # JWT est sans état côté serveur (pas de blacklist) : la déconnexion consiste
    # à faire supprimer les tokens par le client. Endpoint conservé pour la
    # symétrie de l'API et un futur ajout de révocation si nécessaire.
    return {"detail": "Successfully logged out"}


@router.get("/me", response_model=UtilisateurRead)
def read_current_user(current_user: Utilisateur = Depends(get_current_user)):
    return current_user
