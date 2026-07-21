from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, managed_proprietaire_ids, require_gestion
from app.core.security import hash_password
from app.database import get_db
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.lot import Lot
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurRead, UtilisateurUpdate

router = APIRouter(prefix="/tenants", tags=["tenants"])


def _is_my_tenant(db: Session, current_user: Utilisateur, tenant_id: int) -> bool:
    if current_user.role == UtilisateurRole.ADMINISTRATEUR:
        return True
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        proprietaire_ids = [current_user.id]
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        proprietaire_ids = managed_proprietaire_ids(db, current_user.id)
        if not proprietaire_ids:
            return False
    else:
        return False

    return (
        db.query(Bail)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(Bail.locataire_id == tenant_id, Bien.proprietaire_id.in_(proprietaire_ids))
        .first()
        is not None
    )


@router.get("/", response_model=list[UtilisateurRead])
def list_locataires(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Utilisateur).filter(Utilisateur.role == UtilisateurRole.LOCATAIRE)
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = (
            query.join(Bail, Bail.locataire_id == Utilisateur.id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id == current_user.id)
            .distinct()
        )
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = managed_proprietaire_ids(db, current_user.id)
        if not ids:
            return []
        query = (
            query.join(Bail, Bail.locataire_id == Utilisateur.id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id.in_(ids))
            .distinct()
        )
    elif current_user.role != UtilisateurRole.ADMINISTRATEUR:
        return []
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=UtilisateurRead, status_code=status.HTTP_201_CREATED)
def create_locataire(
    locataire_in: UtilisateurCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_gestion),
):
    """Permet à un propriétaire/gestionnaire d'onboarder un locataire, sans passer par un admin."""
    existing = db.query(Utilisateur).filter(Utilisateur.email == locataire_in.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    locataire = Utilisateur(
        nom=locataire_in.nom,
        prenom=locataire_in.prenom,
        email=locataire_in.email,
        mot_de_passe=hash_password(locataire_in.mot_de_passe),
        role=UtilisateurRole.LOCATAIRE,
        statut_compte=locataire_in.statut_compte,
        cree_par_id=current_user.id,
    )
    db.add(locataire)
    db.commit()
    db.refresh(locataire)
    return locataire


@router.get("/{locataire_id}", response_model=UtilisateurRead)
def get_locataire(
    locataire_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    locataire = db.get(Utilisateur, locataire_id)
    if not locataire or locataire.role != UtilisateurRole.LOCATAIRE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    is_self = current_user.id == locataire_id
    if not is_self and not _is_my_tenant(db, current_user, locataire_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this tenant")
    return locataire


@router.put("/{locataire_id}", response_model=UtilisateurRead)
def update_locataire(
    locataire_id: int,
    locataire_in: UtilisateurUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    # Les données de compte (email, mot de passe, rôle...) restent gérées par le
    # locataire lui-même ou un admin, même si un propriétaire/gestionnaire peut le
    # créer et le consulter.
    is_admin = current_user.role == UtilisateurRole.ADMINISTRATEUR
    if not is_admin and current_user.id != locataire_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    locataire = db.get(Utilisateur, locataire_id)
    if not locataire or locataire.role != UtilisateurRole.LOCATAIRE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    update_data = locataire_in.model_dump(exclude_unset=True, exclude={"mot_de_passe"})
    if not is_admin:
        update_data.pop("role", None)
        update_data.pop("statut_compte", None)

    for field, value in update_data.items():
        setattr(locataire, field, value)

    if locataire_in.mot_de_passe:
        locataire.mot_de_passe = hash_password(locataire_in.mot_de_passe)

    db.commit()
    db.refresh(locataire)
    return locataire
