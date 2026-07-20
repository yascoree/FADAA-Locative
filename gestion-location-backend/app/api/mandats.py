from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.database import get_db
from app.models.mandat import Mandat
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.mandat import MandatCreate, MandatRead, MandatUpdate

router = APIRouter(prefix="/mandates", tags=["mandates"])

# Un mandat est le lien de confiance qui donne à un gestionnaire l'accès aux biens
# d'un propriétaire : seul le propriétaire concerné (ou un admin) peut en créer un,
# pour empêcher un gestionnaire de s'auto-accorder l'accès aux biens de quelqu'un d'autre.
require_mandat_creator = require_roles(UtilisateurRole.ADMINISTRATEUR, UtilisateurRole.PROPRIETAIRE)


def _can_view_mandat(current_user: Utilisateur, mandat: Mandat) -> bool:
    return (
        current_user.role == UtilisateurRole.ADMINISTRATEUR
        or current_user.id == mandat.proprietaire_id
        or current_user.id == mandat.gestionnaire_id
    )


@router.get("/", response_model=list[MandatRead])
def list_mandats(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Mandat)
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = query.filter(Mandat.proprietaire_id == current_user.id)
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        query = query.filter(Mandat.gestionnaire_id == current_user.id)
    elif current_user.role != UtilisateurRole.ADMINISTRATEUR:
        return []
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=MandatRead, status_code=status.HTTP_201_CREATED)
def create_mandat(
    mandat_in: MandatCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_mandat_creator),
):
    if (
        current_user.role == UtilisateurRole.PROPRIETAIRE
        and current_user.id != mandat_in.proprietaire_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A proprietaire can only create a mandate for themself",
        )

    gestionnaire = db.get(Utilisateur, mandat_in.gestionnaire_id)
    proprietaire = db.get(Utilisateur, mandat_in.proprietaire_id)
    if not gestionnaire or gestionnaire.role != UtilisateurRole.GESTIONNAIRE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="gestionnaire_id must reference a gestionnaire")
    if not proprietaire or proprietaire.role != UtilisateurRole.PROPRIETAIRE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="proprietaire_id must reference a proprietaire")

    mandat = Mandat(**mandat_in.model_dump())
    db.add(mandat)
    db.commit()
    db.refresh(mandat)
    return mandat


@router.get("/{mandat_id}", response_model=MandatRead)
def get_mandat(
    mandat_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    mandat = db.get(Mandat, mandat_id)
    if not mandat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mandate not found")
    if not _can_view_mandat(current_user, mandat):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this mandate")
    return mandat


@router.put("/{mandat_id}", response_model=MandatRead)
def update_mandat(
    mandat_id: int,
    mandat_in: MandatUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    mandat = db.get(Mandat, mandat_id)
    if not mandat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mandate not found")
    if not _can_view_mandat(current_user, mandat):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this mandate")

    for field, value in mandat_in.model_dump(exclude_unset=True).items():
        setattr(mandat, field, value)

    db.commit()
    db.refresh(mandat)
    return mandat


@router.delete("/{mandat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mandat(
    mandat_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    mandat = db.get(Mandat, mandat_id)
    if not mandat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mandate not found")
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != mandat.proprietaire_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this mandate")
    db.delete(mandat)
    db.commit()
