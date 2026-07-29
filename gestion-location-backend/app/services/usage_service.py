from datetime import datetime

from sqlalchemy.orm import Session

from app.crud import subscription as subscription_crud
from app.models.bail import Bail, BailStatus
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.mandat import Mandat, MandatStatus
from app.models.paiement import Paiement
from app.models.quittance import Quittance
from app.services.exceptions import BadRequest


def compute_owner_usage(db: Session, owner_id: int) -> dict:
    """Compte l'usage réel d'un propriétaire, pour le comparer aux limites de son
    plan (voir app.models.subscription_plan.SubscriptionPlan). Utilisé à la fois
    pour l'affichage (dashboard abonnement) et par enforce_limit ci-dessous pour
    bloquer la création de nouvelles ressources au-delà de ces limites."""
    biens = (
        db.query(Bien)
        .filter(Bien.proprietaire_id == owner_id, Bien.deleted_at.is_(None))
        .count()
    )

    lots = (
        db.query(Lot)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(Bien.proprietaire_id == owner_id, Bien.deleted_at.is_(None), Lot.deleted_at.is_(None))
        .count()
    )

    baux_actifs = (
        db.query(Bail)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id == owner_id,
            Bien.deleted_at.is_(None),
            Lot.deleted_at.is_(None),
            Bail.deleted_at.is_(None),
            Bail.statut == BailStatus.ACTIF,
        )
        .count()
    )

    gestionnaires = (
        db.query(Mandat)
        .filter(
            Mandat.proprietaire_id == owner_id,
            Mandat.deleted_at.is_(None),
            Mandat.statut == MandatStatus.ACTIF,
        )
        .count()
    )

    locataires = (
        db.query(Bail.locataire_id)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id == owner_id,
            Bien.deleted_at.is_(None),
            Lot.deleted_at.is_(None),
            Bail.deleted_at.is_(None),
        )
        .distinct()
        .count()
    )

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    quittances_mois = (
        db.query(Quittance)
        .join(Paiement, Paiement.id == Quittance.paiement_id)
        .join(Echeance, Echeance.id == Paiement.echeance_id)
        .join(Bail, Bail.id == Echeance.bail_id)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id == owner_id,
            Bien.deleted_at.is_(None),
            Lot.deleted_at.is_(None),
            Bail.deleted_at.is_(None),
            Echeance.deleted_at.is_(None),
            Paiement.deleted_at.is_(None),
            Quittance.deleted_at.is_(None),
            Quittance.date_generation >= month_start,
        )
        .count()
    )

    return {
        "biens": biens,
        "lots": lots,
        "baux_actifs": baux_actifs,
        "gestionnaires": gestionnaires,
        "locataires": locataires,
        "quittances_mois": quittances_mois,
    }


# Nom de la limite sur SubscriptionPlan pour chaque clé retournée par
# compute_owner_usage, et libellé lisible pour le message d'erreur.
_LIMIT_FIELDS = {
    "biens": ("max_biens", "biens"),
    "lots": ("max_lots", "lots"),
    "baux_actifs": ("max_baux_actifs", "baux actifs"),
    "gestionnaires": ("max_gestionnaires", "gestionnaires"),
    "locataires": ("max_locataires", "locataires"),
    "quittances_mois": ("max_quittances_mois", "quittances ce mois-ci"),
}


def enforce_limit(db: Session, owner_id: int, resource: str) -> None:
    """Bloque la création d'une nouvelle ressource si le propriétaire a déjà
    atteint la limite de son plan pour ce type de ressource (-1 = illimité).
    Ne bloque rien si le propriétaire n'a pas d'abonnement exploitable — ne
    devrait pas arriver en usage normal (le trial est assigné à l'inscription),
    mais on ne veut pas casser une création légitime sur un cas limite de
    configuration plutôt qu'un vrai dépassement de quota."""
    subscription = subscription_crud.get_by_owner(db, owner_id)
    plan = subscription.plan if subscription else None
    if plan is None:
        return
    field_name, label = _LIMIT_FIELDS[resource]
    limit = getattr(plan, field_name)
    if limit is None or limit < 0:
        return
    usage = compute_owner_usage(db, owner_id)
    if usage[resource] >= limit:
        raise BadRequest(
            f"Limite du plan « {plan.name} » atteinte pour {label} ({limit}). "
            "Passez à un plan supérieur pour continuer."
        )
