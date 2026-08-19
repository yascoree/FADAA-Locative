from datetime import datetime

from sqlalchemy.orm import Session

from app.api.deps import gestionnaire_ids_for_proprietaire
from app.models.bail import Bail, BailStatus
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.mandat import Mandat, MandatStatus
from app.models.paiement import Paiement
from app.models.quittance import Quittance
from app.models.subscription import Subscription
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.services import subscription_service
from app.services.exceptions import PaymentRequired


def _counted_locataire_ids(db: Session, owner_id: int) -> set[int]:
    """Locataire ids that count against owner_id's `locataires` quota: rattachés à
    un bail (quel que soit son statut) sur un bien de ce propriétaire, OU créés
    par lui/l'un de ses gestionnaires même sans bail encore — même périmètre que
    "mes locataires" côté locataire_service.list_locataires. Sans ce deuxième
    ensemble, la limite du plan ne mordait jamais à la création du compte (un
    locataire tout juste créé n'a par définition encore aucun bail), seulement
    bien plus tard au moment du bail — trop tard pour empêcher d'onboarder plus
    de locataires que le plan n'en autorise.

    Extrait de compute_owner_usage pour être aussi utilisable comme test
    d'appartenance (voir is_locataire_counted) par bail_service.create_bail, qui
    doit savoir si UN locataire précis est déjà comptabilisé avant de rappeler
    enforce_limit — plutôt que de dupliquer cette règle avec un raccourci du
    genre "un bail existe-t-il déjà pour cette paire ?", qui ignore le cas d'un
    locataire déjà créé (donc déjà compté) mais pas encore sous bail."""
    bail_linked_locataire_ids = {
        row[0]
        for row in db.query(Bail.locataire_id)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id == owner_id,
            Bien.deleted_at.is_(None),
            Lot.deleted_at.is_(None),
            Bail.deleted_at.is_(None),
        )
        .distinct()
        .all()
    }
    creator_ids = [owner_id, *gestionnaire_ids_for_proprietaire(db, owner_id)]
    created_locataire_ids = {
        row[0]
        for row in db.query(Utilisateur.id).filter(
            Utilisateur.role == UtilisateurRole.LOCATAIRE,
            Utilisateur.deleted_at.is_(None),
            Utilisateur.cree_par_id.in_(creator_ids),
        )
    }
    return bail_linked_locataire_ids | created_locataire_ids


def is_locataire_counted(db: Session, owner_id: int, locataire_id: int) -> bool:
    """True if locataire_id already counts against owner_id's `locataires` quota
    (see _counted_locataire_ids) — used by bail_service.create_bail to decide
    whether attaching a bail to this locataire needs a fresh enforce_limit check,
    or whether they're already accounted for (e.g. onboarded earlier without a
    bail yet) and attaching a bail to them doesn't consume an additional slot."""
    return locataire_id in _counted_locataire_ids(db, owner_id)


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

    locataires = len(_counted_locataire_ids(db, owner_id))

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
    configuration plutôt qu'un vrai dépassement de quota.

    Verrouille la ligne Subscription du propriétaire (SELECT ... FOR UPDATE) le
    temps de la requête : count-puis-insert n'est pas atomique, donc deux
    créations concurrentes peuvent toutes les deux lire un compte encore sous la
    limite avant qu'aucune n'ait committé, et donc toutes les deux passer. Ce
    verrou est relâché au commit (ou rollback) de la transaction appelante — qui
    inclut toujours l'INSERT de la ressource elle-même (voir bien_service.
    create_bien et les autres appelants) — donc une deuxième requête concurrente
    sur le MÊME propriétaire attend que la première ait fini avant de compter à
    son tour, avec un compte qui reflète déjà l'insertion précédente."""
    subscription = (
        db.query(Subscription)
        .filter(Subscription.owner_id == owner_id, Subscription.deleted_at.is_(None))
        .with_for_update()
        .first()
    )
    plan = subscription.plan if subscription else None
    if plan is None:
        return
    if not subscription_service.is_active(subscription):
        raise PaymentRequired(
            f"Votre abonnement « {plan.name} » a expiré ou est suspendu. "
            "Renouvelez-le ou passez à un plan supérieur pour continuer."
        )
    field_name, label = _LIMIT_FIELDS[resource]
    limit = getattr(plan, field_name)
    if limit is None or limit < 0:
        return
    usage = compute_owner_usage(db, owner_id)
    if usage[resource] >= limit:
        raise PaymentRequired(
            f"Limite du plan « {plan.name} » atteinte pour {label} ({limit}). "
            "Passez à un plan supérieur pour continuer."
        )
