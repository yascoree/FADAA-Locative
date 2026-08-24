from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import can_access_proprietaire, get_current_user, managed_proprietaire_ids
from app.database import get_db
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.stats import RevenueStats
from app.services.stats_service import (
    get_admin_dashboard_stats,
    get_gestionnaire_dashboard_stats,
    get_locataire_dashboard_stats,
    get_proprietaire_dashboard_stats,
    get_revenue_stats,
)

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/dashboard")
def read_dashboard_stats(
    proprietaire_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Statistiques de tableau de bord — la forme de la réponse dépend du rôle de
    l'appelant (chaque frontend ne consomme que la sienne) :
    - ADMINISTRATEUR -> AdminDashboardStats
    - PROPRIETAIRE   -> ProprietaireDashboardStats
    - GESTIONNAIRE   -> GestionnaireDashboardStats
    - LOCATAIRE      -> LocataireDashboardStats
    """
    if current_user.role == UtilisateurRole.ADMINISTRATEUR:
        return get_admin_dashboard_stats(db)
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        if proprietaire_id is not None and proprietaire_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this proprietaire")
        owner_id = proprietaire_id or current_user.id
        return get_proprietaire_dashboard_stats(db, owner_id)
    if current_user.role == UtilisateurRole.GESTIONNAIRE:
        if proprietaire_id is not None:
            if not can_access_proprietaire(db, current_user, proprietaire_id):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this proprietaire")
            return get_gestionnaire_dashboard_stats(db, current_user.id, owner_ids_override=[proprietaire_id])
        return get_gestionnaire_dashboard_stats(db, current_user.id)
    if current_user.role == UtilisateurRole.LOCATAIRE:
        if proprietaire_id is not None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to scope dashboard by proprietaire")
        return get_locataire_dashboard_stats(db, current_user.id)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No dashboard stats for this role")


@router.get("/revenue", response_model=RevenueStats)
def read_revenue_stats(
    proprietaire_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Statistiques de revenus locatifs (courbe 12 mois, année vs année, répartition
    par bien/mode de paiement, taux de recouvrement) — propriétaire (ses propres
    biens) ou gestionnaire (biens de tous les propriétaires qu'il gère)."""
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        if proprietaire_id is not None and proprietaire_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this proprietaire")
        owner_ids = [proprietaire_id or current_user.id]
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        if proprietaire_id is not None:
            if not can_access_proprietaire(db, current_user, proprietaire_id):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this proprietaire")
            owner_ids = [proprietaire_id]
        else:
            owner_ids = managed_proprietaire_ids(db, current_user.id)
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access revenue stats")
    return get_revenue_stats(db, owner_ids)
