from datetime import datetime

from sqlalchemy.orm import Session

from app.models.bail import Bail, BailStatus
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.mandat import Mandat, MandatStatus
from app.models.paiement import Paiement
from app.models.quittance import Quittance


def compute_owner_usage(db: Session, owner_id: int) -> dict:
    """Compte l'usage réel d'un propriétaire, pour le comparer aux limites de son
    plan (voir app.models.subscription_plan.SubscriptionPlan). Purement informatif
    ici — rien n'empêche encore la création au-delà de ces limites."""
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
