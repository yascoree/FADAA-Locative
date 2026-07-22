from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.profil import Profil
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.profil import ProfilCreate, ProfilRead, ProfilUpdate

router = APIRouter(prefix="/profiles", tags=["profiles"])


def _ensure_owner_or_admin(current_user: Utilisateur, utilisateur_id: int) -> None:
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != utilisateur_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this profile")


@router.post("/", response_model=ProfilRead, status_code=status.HTTP_201_CREATED)
def create_profil(
    profil_in: ProfilCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    _ensure_owner_or_admin(current_user, profil_in.utilisateur_id)

    # existing = db.query(Profil).filter(Profil.utilisateur_id == profil_in.utilisateur_id).first()
    existing = (
    db.query(Profil)
    .filter(
        Profil.utilisateur_id == profil_in.utilisateur_id,
        Profil.deleted_at.is_(None)
    )
    .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Profile already exists")

    profil = Profil(**profil_in.model_dump())
    db.add(profil)
    db.commit()
    db.refresh(profil)
    return profil


@router.get("/{utilisateur_id}", response_model=ProfilRead)
def get_profil(
    utilisateur_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    _ensure_owner_or_admin(current_user, utilisateur_id)

    # profil = db.query(Profil).filter(Profil.utilisateur_id == utilisateur_id).first()

    profil = (
    db.query(Profil)
    .filter(
        Profil.utilisateur_id == utilisateur_id,
        Profil.deleted_at.is_(None)
    )
    .first()
    )

    if not profil:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profil


@router.put("/{utilisateur_id}", response_model=ProfilRead)
def update_profil(
    utilisateur_id: int,
    profil_in: ProfilUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    _ensure_owner_or_admin(current_user, utilisateur_id)

    # profil = db.query(Profil).filter(Profil.utilisateur_id == utilisateur_id).first()

    profil = (
    db.query(Profil)
    .filter(
        Profil.utilisateur_id == utilisateur_id,
        Profil.deleted_at.is_(None)
    )
    .first()
    )
    
    if not profil:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    for field, value in profil_in.model_dump(exclude_unset=True).items():
        setattr(profil, field, value)

    db.commit()
    db.refresh(profil)
    return profil
