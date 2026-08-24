from datetime import date, datetime, timedelta

from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.api.deps import active_agence_id
from app.models.bail import Bail, BailStatus
from app.models.bien import Bien
from app.models.charge import Charge
from app.models.echeance import Echeance, EcheanceStatus
from app.models.lot import Lot, LotStatus
from app.models.mandat import Mandat, MandatStatus
from app.models.paiement import Paiement, PaiementStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.subscription_plan import SubscriptionPlan
from app.models.utilisateur import StatutCompte, Utilisateur
from app.schemas.stats import (
    AdminDashboardStats,
    BienRevenue,
    GestionnaireDashboardStats,
    LocataireDashboardStats,
    ModeRevenue,
    MonthAmount,
    MonthCount,
    PlanCount,
    ProprietaireDashboardStats,
    RevenueStats,
    StatusCount,
)

# ---------- Helpers ----------


def _last_n_months(n: int) -> list[tuple[int, int]]:
    """[(année, mois), ...] du plus ancien au plus récent, n derniers mois inclus le mois courant."""
    now = date.today()
    months = []
    for i in range(n - 1, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        months.append((y, m))
    return months


def _fill_month_counts(rows, months: list[tuple[int, int]]) -> list[MonthCount]:
    counts = {(int(r.year), int(r.month)): int(r.count) for r in rows}
    return [MonthCount(year=y, month=m, count=counts.get((y, m), 0)) for y, m in months]


def _fill_month_amounts(rows, months: list[tuple[int, int]]) -> list[MonthAmount]:
    totals = {(int(r.year), int(r.month)): float(r.total or 0) for r in rows}
    return [MonthAmount(year=y, month=m, total=totals.get((y, m), 0.0)) for y, m in months]


def _fill_month_amounts_net(revenue_rows, charges_rows, months: list[tuple[int, int]]) -> list[MonthAmount]:
    """Same as _fill_month_amounts, but each month's total has that month's
    Charge amounts (see charge_service) deducted — never below zero."""
    revenue_totals = {(int(r.year), int(r.month)): float(r.total or 0) for r in revenue_rows}
    charges_totals = {(int(r.year), int(r.month)): float(r.total or 0) for r in charges_rows}
    return [
        MonthAmount(year=y, month=m, total=max(0.0, revenue_totals.get((y, m), 0.0) - charges_totals.get((y, m), 0.0)))
        for y, m in months
    ]


# ---------- Admin ----------


def get_admin_dashboard_stats(db: Session) -> AdminDashboardStats:
    total_users = db.query(func.count(Utilisateur.id)).scalar() or 0
    active_accounts = (
        db.query(func.count(Utilisateur.id)).filter(Utilisateur.statut_compte == StatutCompte.ACTIF).scalar() or 0
    )

    active_subs_query = (
        db.query(Subscription, SubscriptionPlan)
        .join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
        .filter(Subscription.status == SubscriptionStatus.ACTIF)
    )
    active_subs = active_subs_query.all()
    active_subscriptions = len(active_subs)
    mrr = sum(float(plan.price) for _sub, plan in active_subs if not plan.is_trial)
    payantes = sum(1 for _sub, plan in active_subs if not plan.is_trial)
    arpu = mrr / payantes if payantes > 0 else 0.0
    activation_rate = (active_accounts / total_users * 100) if total_users > 0 else 0.0

    months = _last_n_months(6)
    signup_rows = (
        db.query(
            extract("year", Utilisateur.date_creation).label("year"),
            extract("month", Utilisateur.date_creation).label("month"),
            func.count(Utilisateur.id).label("count"),
        )
        .filter(Utilisateur.date_creation >= datetime(months[0][0], months[0][1], 1))
        .group_by("year", "month")
        .all()
    )

    status_rows = (
        db.query(Subscription.status.label("status"), func.count(Subscription.id).label("count"))
        .group_by(Subscription.status)
        .all()
    )

    plan_rows = (
        db.query(
            SubscriptionPlan.id.label("plan_id"),
            SubscriptionPlan.name.label("plan_name"),
            SubscriptionPlan.is_trial.label("is_trial"),
            func.count(Subscription.id).label("count"),
        )
        .outerjoin(Subscription, Subscription.plan_id == SubscriptionPlan.id)
        .group_by(SubscriptionPlan.id, SubscriptionPlan.name, SubscriptionPlan.is_trial)
        .all()
    )

    return AdminDashboardStats(
        total_users=total_users,
        active_subscriptions=active_subscriptions,
        mrr=mrr,
        arpu=arpu,
        activation_rate=activation_rate,
        signups_last_6_months=_fill_month_counts(signup_rows, months),
        subscriptions_by_status=[StatusCount(status=int(r.status), count=int(r.count)) for r in status_rows],
        subscriptions_by_plan=[
            PlanCount(plan_id=r.plan_id, plan_name=r.plan_name, is_trial=r.is_trial, count=int(r.count))
            for r in plan_rows
        ],
    )


# ---------- Propriétaire ----------


def _proprietaire_counts(db: Session, owner_ids: list[int]):
    total_biens = db.query(func.count(Bien.id)).filter(Bien.proprietaire_id.in_(owner_ids)).scalar() or 0

    lots_query = db.query(Lot).join(Bien, Bien.id == Lot.bien_id).filter(Bien.proprietaire_id.in_(owner_ids))
    total_lots = lots_query.with_entities(func.count(Lot.id)).scalar() or 0
    lots_occupes = lots_query.filter(Lot.statut == LotStatus.LOUE).with_entities(func.count(Lot.id)).scalar() or 0
    lots_by_status_rows = (
        db.query(Lot.statut.label("status"), func.count(Lot.id).label("count"))
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(Bien.proprietaire_id.in_(owner_ids))
        .group_by(Lot.statut)
        .all()
    )

    baux_query = (
        db.query(Bail)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(Bien.proprietaire_id.in_(owner_ids))
    )
    baux_actifs = (
        baux_query.filter(Bail.statut == BailStatus.ACTIF).with_entities(func.count(Bail.id)).scalar() or 0
    )
    baux_by_status_rows = (
        db.query(Bail.statut.label("status"), func.count(Bail.id).label("count"))
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(Bien.proprietaire_id.in_(owner_ids))
        .group_by(Bail.statut)
        .all()
    )

    today = date.today()
    echeances_en_retard_query = (
        db.query(Echeance)
        .join(Bail, Bail.id == Echeance.bail_id)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id.in_(owner_ids),
            Echeance.date_echeance < today,
            Echeance.statut.in_([EcheanceStatus.IMPAYE, EcheanceStatus.PARTIEL]),
        )
    )
    echeances_en_retard = echeances_en_retard_query.with_entities(func.count(Echeance.id)).scalar() or 0
    montant_en_retard = (
        echeances_en_retard_query.with_entities(func.coalesce(func.sum(Echeance.montant_du), 0)).scalar() or 0
    )

    month_start = today.replace(day=1)
    revenu_mois_brut = (
        db.query(func.coalesce(func.sum(Paiement.montant), 0))
        .join(Echeance, Echeance.id == Paiement.echeance_id)
        .join(Bail, Bail.id == Echeance.bail_id)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id.in_(owner_ids),
            Paiement.date_paiement >= month_start,
            Paiement.statut == PaiementStatus.VALIDE,
            Paiement.encaisse.is_(True),
            Paiement.deleted_at.is_(None),
        )
        .scalar()
        or 0
    )
    # Une charge liée à un bien OU à un lot (jamais les deux, voir
    # charge_service._resolve_bien) est déduite du revenu du mois correspondant.
    charges_mois = (
        db.query(func.coalesce(func.sum(Charge.montant), 0))
        .outerjoin(Lot, Lot.id == Charge.lot_id)
        .join(Bien, Bien.id == func.coalesce(Charge.bien_id, Lot.bien_id))
        .filter(
            Bien.proprietaire_id.in_(owner_ids),
            Charge.date_charge >= month_start,
            Charge.deleted_at.is_(None),
        )
        .scalar()
        or 0
    )
    revenu_mois = max(0, revenu_mois_brut - charges_mois)

    return {
        "total_biens": total_biens,
        "total_lots": total_lots,
        "lots_occupes": lots_occupes,
        "lots_by_status": [
            StatusCount(status=int(r.status), count=int(r.count)) for r in lots_by_status_rows if r.status is not None
        ],
        "baux_actifs": baux_actifs,
        "baux_by_status": [
            StatusCount(status=int(r.status), count=int(r.count)) for r in baux_by_status_rows if r.status is not None
        ],
        "echeances_en_retard": echeances_en_retard,
        "montant_en_retard": float(montant_en_retard),
        "revenu_mois": float(revenu_mois),
    }


def get_proprietaire_dashboard_stats(db: Session, owner_id: int) -> ProprietaireDashboardStats:
    counts = _proprietaire_counts(db, [owner_id])
    return ProprietaireDashboardStats(**counts)


def get_gestionnaire_dashboard_stats(
    db: Session, gestionnaire_id: int, owner_ids_override: list[int] | None = None
) -> GestionnaireDashboardStats:
    if owner_ids_override is None:
        agence_id = active_agence_id(db, gestionnaire_id)
        owner_ids = (
            db.query(Mandat.proprietaire_id)
            .filter(Mandat.agence_id == agence_id, Mandat.statut == MandatStatus.ACTIF)
            .all()
            if agence_id is not None
            else []
        )
        owner_ids = [row[0] for row in owner_ids]
    else:
        owner_ids = owner_ids_override
    if not owner_ids:
        return GestionnaireDashboardStats(
            proprietaires_geres=0,
            total_biens=0,
            total_lots=0,
            lots_occupes=0,
            baux_actifs=0,
            echeances_en_retard=0,
            montant_en_retard=0.0,
            revenu_mois=0.0,
            lots_by_status=[],
            baux_by_status=[],
        )
    counts = _proprietaire_counts(db, owner_ids)
    return GestionnaireDashboardStats(
        proprietaires_geres=len(owner_ids),
        total_biens=counts["total_biens"],
        total_lots=counts["total_lots"],
        lots_occupes=counts["lots_occupes"],
        baux_actifs=counts["baux_actifs"],
        echeances_en_retard=counts["echeances_en_retard"],
        montant_en_retard=counts["montant_en_retard"],
        revenu_mois=counts["revenu_mois"],
        lots_by_status=counts["lots_by_status"],
        baux_by_status=counts["baux_by_status"],
    )


# ---------- Locataire ----------


def get_locataire_dashboard_stats(db: Session, locataire_id: int) -> LocataireDashboardStats:
    baux_actifs = (
        db.query(func.count(Bail.id))
        .filter(Bail.locataire_id == locataire_id, Bail.statut == BailStatus.ACTIF)
        .scalar()
        or 0
    )

    today = date.today()
    echeances_en_retard = (
        db.query(func.count(Echeance.id))
        .join(Bail, Bail.id == Echeance.bail_id)
        .filter(
            Bail.locataire_id == locataire_id,
            Echeance.date_echeance < today,
            Echeance.statut.in_([EcheanceStatus.IMPAYE, EcheanceStatus.PARTIEL]),
        )
        .scalar()
        or 0
    )

    year_start = today.replace(month=1, day=1)
    total_paye = (
        db.query(func.coalesce(func.sum(Paiement.montant), 0))
        .join(Echeance, Echeance.id == Paiement.echeance_id)
        .join(Bail, Bail.id == Echeance.bail_id)
        .filter(
            Bail.locataire_id == locataire_id,
            Paiement.date_paiement >= year_start,
            Paiement.statut == PaiementStatus.VALIDE,
            Paiement.deleted_at.is_(None),
        )
        .scalar()
        or 0
    )

    prochaine = (
        db.query(Echeance)
        .join(Bail, Bail.id == Echeance.bail_id)
        .filter(
            Bail.locataire_id == locataire_id,
            Echeance.date_echeance >= today,
            Echeance.statut != EcheanceStatus.PAYE,
        )
        .order_by(Echeance.date_echeance.asc())
        .first()
    )

    return LocataireDashboardStats(
        baux_actifs=baux_actifs,
        echeances_en_retard=echeances_en_retard,
        total_paye_cette_annee=float(total_paye),
        prochaine_echeance_date=prochaine.date_echeance.isoformat() if prochaine and prochaine.date_echeance else None,
        prochaine_echeance_montant=float(prochaine.montant_du) if prochaine and prochaine.montant_du is not None else None,
    )


# ---------- Revenus (propriétaire / gestionnaire) ----------


def get_revenue_stats(db: Session, owner_ids: list[int]) -> RevenueStats:
    if not owner_ids:
        return RevenueStats(
            current_year_by_month=[],
            previous_year_by_month=[],
            trailing_12_months=[],
            by_bien=[],
            by_mode=[],
            taux_recouvrement=None,
        )

    today = date.today()
    current_year = today.year

    def _paiements_query():
        return (
            db.query(Paiement)
            .join(Echeance, Echeance.id == Paiement.echeance_id)
            .join(Bail, Bail.id == Echeance.bail_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(
                Bien.proprietaire_id.in_(owner_ids),
                Paiement.statut == PaiementStatus.VALIDE,
                Paiement.encaisse.is_(True),
                Paiement.deleted_at.is_(None),
            )
        )

    def _charges_query():
        # Une charge est liée à un bien OU à un lot (jamais les deux, voir
        # charge_service._resolve_bien) : la jointure combine les deux chemins
        # vers Bien pour couvrir les deux cas dans une seule requête.
        return (
            db.query(Charge)
            .outerjoin(Lot, Lot.id == Charge.lot_id)
            .join(Bien, Bien.id == func.coalesce(Charge.bien_id, Lot.bien_id))
            .filter(Bien.proprietaire_id.in_(owner_ids), Charge.deleted_at.is_(None))
        )

    def _monthly_rows(start: datetime, end: datetime):
        return (
            _paiements_query()
            .with_entities(
                extract("year", Paiement.date_paiement).label("year"),
                extract("month", Paiement.date_paiement).label("month"),
                func.sum(Paiement.montant).label("total"),
            )
            .filter(Paiement.date_paiement >= start, Paiement.date_paiement < end)
            .group_by("year", "month")
            .all()
        )

    def _monthly_charges(start: datetime, end: datetime):
        return (
            _charges_query()
            .with_entities(
                extract("year", Charge.date_charge).label("year"),
                extract("month", Charge.date_charge).label("month"),
                func.sum(Charge.montant).label("total"),
            )
            .filter(Charge.date_charge >= start, Charge.date_charge < end)
            .group_by("year", "month")
            .all()
        )

    trailing_months = _last_n_months(12)
    trailing_start = datetime(trailing_months[0][0], trailing_months[0][1], 1)
    trailing_end = datetime(today.year, today.month, 1) + timedelta(days=32)
    trailing_rows = _monthly_rows(trailing_start, trailing_end)
    trailing_charges_rows = _monthly_charges(trailing_start, trailing_end)
    trailing_12_months = _fill_month_amounts_net(trailing_rows, trailing_charges_rows, trailing_months)

    current_year_months = [(current_year, m) for m in range(1, 13)]
    current_year_rows = _monthly_rows(datetime(current_year, 1, 1), datetime(current_year + 1, 1, 1))
    current_year_charges_rows = _monthly_charges(datetime(current_year, 1, 1), datetime(current_year + 1, 1, 1))
    current_year_by_month = _fill_month_amounts_net(current_year_rows, current_year_charges_rows, current_year_months)

    previous_year_months = [(current_year - 1, m) for m in range(1, 13)]
    previous_year_rows = _monthly_rows(datetime(current_year - 1, 1, 1), datetime(current_year, 1, 1))
    previous_year_charges_rows = _monthly_charges(datetime(current_year - 1, 1, 1), datetime(current_year, 1, 1))
    previous_year_by_month = _fill_month_amounts_net(previous_year_rows, previous_year_charges_rows, previous_year_months)

    year_start = datetime(current_year, 1, 1)
    by_bien_revenue_rows = (
        _paiements_query()
        .with_entities(Bien.id.label("bien_id"), Bien.designation.label("designation"), func.sum(Paiement.montant).label("total"))
        .filter(Paiement.date_paiement >= year_start)
        .group_by(Bien.id, Bien.designation)
        .all()
    )
    by_bien_charges_rows = (
        _charges_query()
        .with_entities(
            func.coalesce(Charge.bien_id, Lot.bien_id).label("bien_id"),
            func.sum(Charge.montant).label("total"),
        )
        .filter(Charge.date_charge >= year_start.date())
        .group_by(func.coalesce(Charge.bien_id, Lot.bien_id))
        .all()
    )
    charges_by_bien = {r.bien_id: float(r.total or 0) for r in by_bien_charges_rows}
    designation_by_bien = {r.bien_id: r.designation for r in by_bien_revenue_rows}
    revenue_by_bien = {r.bien_id: float(r.total or 0) for r in by_bien_revenue_rows}
    all_bien_ids = set(revenue_by_bien) | set(charges_by_bien)
    by_bien = sorted(
        (
            BienRevenue(
                bien_id=bid,
                designation=designation_by_bien.get(bid) or f"Bien #{bid}",
                total=max(0.0, revenue_by_bien.get(bid, 0.0) - charges_by_bien.get(bid, 0.0)),
            )
            for bid in all_bien_ids
        ),
        key=lambda b: b.total,
        reverse=True,
    )

    by_mode_rows = (
        _paiements_query()
        .with_entities(Paiement.mode_paiement.label("mode"), func.sum(Paiement.montant).label("total"))
        .filter(Paiement.date_paiement >= year_start)
        .group_by(Paiement.mode_paiement)
        .order_by(func.sum(Paiement.montant).desc())
        .all()
    )
    by_mode = [ModeRevenue(mode=int(r.mode) if r.mode is not None else None, total=float(r.total or 0)) for r in by_mode_rows]

    encaisse_cette_annee = sum(m.total for m in current_year_by_month)
    du_cette_annee = (
        db.query(func.coalesce(func.sum(Echeance.montant_du), 0))
        .join(Bail, Bail.id == Echeance.bail_id)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(Bien.proprietaire_id.in_(owner_ids), Echeance.date_echeance >= year_start.date())
        .scalar()
        or 0
    )
    taux_recouvrement = min(100.0, (encaisse_cette_annee / float(du_cette_annee) * 100)) if du_cette_annee else None

    return RevenueStats(
        current_year_by_month=current_year_by_month,
        previous_year_by_month=previous_year_by_month,
        trailing_12_months=trailing_12_months,
        by_bien=by_bien,
        by_mode=by_mode,
        taux_recouvrement=taux_recouvrement,
    )
