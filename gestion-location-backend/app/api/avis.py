from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.database import get_db
from app.models.avis import Avis, AvisStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.avis import AvisCreate, AvisRead, AvisUpdate

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/", response_model=list[AvisRead])
def list_avis(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Avis)
    if current_user.role != UtilisateurRole.ADMINISTRATEUR:
        query = query.filter(or_(Avis.statut == AvisStatus.PUBLIE, Avis.user_id == current_user.id))
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=AvisRead, status_code=status.HTTP_201_CREATED)
def create_avis(
    avis_in: AvisCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and avis_in.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create a review for another user")

    avis = Avis(**avis_in.model_dump())
    db.add(avis)
    db.commit()
    db.refresh(avis)
    return avis


@router.get("/{avis_id}", response_model=AvisRead)
def get_avis(
    avis_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    avis = db.get(Avis, avis_id)
    if not avis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avis not found")
    is_owner_or_admin = current_user.role == UtilisateurRole.ADMINISTRATEUR or current_user.id == avis.user_id
    if not is_owner_or_admin and avis.statut != AvisStatus.PUBLIE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this review")
    return avis


@router.put("/{avis_id}", response_model=AvisRead)
def update_avis(
    avis_id: int,
    avis_in: AvisUpdate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    # Le seul champ modifiable via ce endpoint est `statut` : c'est la modération, réservée aux admins.
    avis = db.get(Avis, avis_id)
    if not avis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avis not found")

    for field, value in avis_in.model_dump(exclude_unset=True).items():
        setattr(avis, field, value)

    db.commit()
    db.refresh(avis)
    return avis


@router.delete("/{avis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_avis(
    avis_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    avis = db.get(Avis, avis_id)
    if not avis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avis not found")
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != avis.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this review")
    db.delete(avis)
    db.commit()
