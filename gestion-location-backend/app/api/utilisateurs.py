from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.security import hash_password
from app.database import get_db
from app.models.utilisateur import StatutCompte, Utilisateur, UtilisateurRole
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurRead, UtilisateurUpdate
from app.services import subscription_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UtilisateurRead])
def list_utilisateurs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    return db.query(Utilisateur).offset(skip).limit(limit).all()


@router.post("/", response_model=UtilisateurRead, status_code=status.HTTP_201_CREATED)
def create_utilisateur(
    utilisateur_in: UtilisateurCreate,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    """Réservé aux admins : création directe d'un compte avec un rôle donné.
    L'inscription publique passe par /auth/register (toujours en Propriétaire)."""
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

    if utilisateur.role == UtilisateurRole.PROPRIETAIRE:
        subscription_service.create_trial_subscription(db, utilisateur.id)

    return utilisateur


@router.get("/{utilisateur_id}", response_model=UtilisateurRead)
def get_utilisateur(
    utilisateur_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != utilisateur_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    utilisateur = db.get(Utilisateur, utilisateur_id)
    if not utilisateur:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return utilisateur


@router.put("/{utilisateur_id}", response_model=UtilisateurRead)
def update_utilisateur(
    utilisateur_id: int,
    utilisateur_in: UtilisateurUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    is_admin = current_user.role == UtilisateurRole.ADMINISTRATEUR
    if not is_admin and current_user.id != utilisateur_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    utilisateur = db.get(Utilisateur, utilisateur_id)
    if not utilisateur:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = utilisateur_in.model_dump(exclude_unset=True, exclude={"mot_de_passe"})
    if not is_admin:
        # Un utilisateur ne peut pas s'auto-promouvoir ni changer son statut de compte.
        update_data.pop("role", None)
        update_data.pop("statut_compte", None)

    for field, value in update_data.items():
        setattr(utilisateur, field, value)

    if utilisateur_in.mot_de_passe:
        utilisateur.mot_de_passe = hash_password(utilisateur_in.mot_de_passe)

    db.commit()
    db.refresh(utilisateur)
    return utilisateur


@router.delete("/{utilisateur_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_utilisateur(
    utilisateur_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    utilisateur = db.get(Utilisateur, utilisateur_id)
    if not utilisateur:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    db.delete(utilisateur)
    db.commit()


@router.post("/{utilisateur_id}/activate", response_model=UtilisateurRead)
def activate_utilisateur(
    utilisateur_id: int,
    db: Session = Depends(get_db),
    _admin: Utilisateur = Depends(require_admin),
):
    utilisateur = db.get(Utilisateur, utilisateur_id)
    if not utilisateur:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    utilisateur.statut_compte = StatutCompte.ACTIF
    db.commit()
    db.refresh(utilisateur)
    return utilisateur


@router.post("/{utilisateur_id}/deactivate", response_model=UtilisateurRead)
def deactivate_utilisateur(
    utilisateur_id: int,
    db: Session = Depends(get_db),
    admin: Utilisateur = Depends(require_admin),
):
    if utilisateur_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own account")

    utilisateur = db.get(Utilisateur, utilisateur_id)
    if not utilisateur:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Réutilise CREE_SANS_ACCES comme statut "désactivé" : get_current_user() / login()
    # rejettent tout compte dont statut_compte != ACTIF, donc ceci coupe l'accès
    # immédiatement, y compris pour un token déjà émis.
    utilisateur.statut_compte = StatutCompte.CREE_SANS_ACCES
    db.commit()
    db.refresh(utilisateur)
    return utilisateur
