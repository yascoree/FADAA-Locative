from typing import Optional

from pydantic import BaseModel


class MonthCount(BaseModel):
    year: int
    month: int
    count: int


class MonthAmount(BaseModel):
    year: int
    month: int
    total: float


class StatusCount(BaseModel):
    status: int
    count: int


class PlanCount(BaseModel):
    plan_id: int
    plan_name: str
    is_trial: bool
    count: int


class BienRevenue(BaseModel):
    bien_id: int
    designation: str
    total: float


class ModeRevenue(BaseModel):
    mode: Optional[int]
    total: float


class AdminDashboardStats(BaseModel):
    total_users: int
    active_subscriptions: int
    mrr: float
    arpu: float
    activation_rate: float
    signups_last_6_months: list[MonthCount]
    subscriptions_by_status: list[StatusCount]
    subscriptions_by_plan: list[PlanCount]


class ProprietaireDashboardStats(BaseModel):
    total_biens: int
    total_lots: int
    lots_occupes: int
    baux_actifs: int
    echeances_en_retard: int
    montant_en_retard: float
    revenu_mois: float
    lots_by_status: list[StatusCount]
    baux_by_status: list[StatusCount]


class GestionnaireDashboardStats(BaseModel):
    proprietaires_geres: int
    total_biens: int
    total_lots: int
    baux_actifs: int
    echeances_en_retard: int
    montant_en_retard: float
    revenu_mois: float


class LocataireDashboardStats(BaseModel):
    baux_actifs: int
    echeances_en_retard: int
    total_paye_cette_annee: float
    prochaine_echeance_date: Optional[str] = None
    prochaine_echeance_montant: Optional[float] = None


class RevenueStats(BaseModel):
    current_year_by_month: list[MonthAmount]
    previous_year_by_month: list[MonthAmount]
    trailing_12_months: list[MonthAmount]
    by_bien: list[BienRevenue]
    by_mode: list[ModeRevenue]
    taux_recouvrement: Optional[float] = None
