from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, managed_proprietaire_ids
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
        return get_proprietaire_dashboard_stats(db, current_user.id)
    if current_user.role == UtilisateurRole.GESTIONNAIRE:
        return get_gestionnaire_dashboard_stats(db, current_user.id)
    if current_user.role == UtilisateurRole.LOCATAIRE:
        return get_locataire_dashboard_stats(db, current_user.id)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No dashboard stats for this role")


@router.get("/revenue", response_model=RevenueStats)
def read_revenue_stats(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Statistiques de revenus locatifs (courbe 12 mois, année vs année, répartition
    par bien/mode de paiement, taux de recouvrement) — propriétaire (ses propres
    biens) ou gestionnaire (biens de tous les propriétaires qu'il gère)."""
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        owner_ids = [current_user.id]
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        owner_ids = managed_proprietaire_ids(db, current_user.id)
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access revenue stats")
    return get_revenue_stats(db, owner_ids)
