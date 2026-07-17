from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurRead, UtilisateurUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UtilisateurRead])
def list_utilisateurs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Utilisateur).offset(skip).limit(limit).all()


@router.post("/", response_model=UtilisateurRead, status_code=status.HTTP_201_CREATED)
def create_utilisateur(utilisateur_in: UtilisateurCreate, db: Session = Depends(get_db)):
    existing_utilisateur = db.query(Utilisateur).filter(Utilisateur.email == utilisateur_in.email).first()
    if existing_utilisateur:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    utilisateur = Utilisateur(
        nom=utilisateur_in.nom,
        prenom=utilisateur_in.prenom,
        email=utilisateur_in.email,
        mot_de_passe=hash_password(utilisateur_in.mot_de_passe),
        role=utilisateur_in.role,
        statut_compte=utilisateur_in.statut_compte,
        cree_par_id=utilisateur_in.cree_par_id,
    )
    db.add(utilisateur)
    db.commit()
    db.refresh(utilisateur)
    return utilisateur


@router.get("/{utilisateur_id}", response_model=UtilisateurRead)
def get_utilisateur(utilisateur_id: int, db: Session = Depends(get_db)):
    utilisateur = db.get(Utilisateur, utilisateur_id)
    if not utilisateur:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return utilisateur


@router.put("/{utilisateur_id}", response_model=UtilisateurRead)
def update_utilisateur(utilisateur_id: int, utilisateur_in: UtilisateurUpdate, db: Session = Depends(get_db)):
    utilisateur = db.get(Utilisateur, utilisateur_id)
    if not utilisateur:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = utilisateur_in.model_dump(exclude_unset=True, exclude={"mot_de_passe"})
    for field, value in update_data.items():
        setattr(utilisateur, field, value)

    if utilisateur_in.mot_de_passe:
        utilisateur.mot_de_passe = hash_password(utilisateur_in.mot_de_passe)

    db.commit()
    db.refresh(utilisateur)
    return utilisateur


@router.delete("/{utilisateur_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_utilisateur(utilisateur_id: int, db: Session = Depends(get_db)):
    utilisateur = db.get(Utilisateur, utilisateur_id)
    if not utilisateur:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    db.delete(utilisateur)
    db.commit()
