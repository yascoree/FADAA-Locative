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
from app.api.deps import gestionnaire_ids_for_proprietaire, managed_proprietaire_ids, active_agence_id
from app.services import subscription_service
from app.services.exceptions import PaymentRequired


def _counted_locataire_ids(db: Session, owner_id: int) -> set[int]:
    owner = db.get(Utilisateur, owner_id)
    is_gestionnaire = owner and owner.role == UtilisateurRole.GESTIONNAIRE
    
    if is_gestionnaire:
        target_proprietaire_ids = managed_proprietaire_ids(db, owner_id)
        if not target_proprietaire_ids:
            target_proprietaire_ids = [-1]
    else:
        target_proprietaire_ids = [owner_id]

    bail_linked_locataire_ids = {
        row[0]
        for row in db.query(Bail.locataire_id)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id.in_(target_proprietaire_ids),
            Bien.deleted_at.is_(None),
            Lot.deleted_at.is_(None),
            Bail.deleted_at.is_(None),
        )
        .distinct()
        .all()
    }
    
    if is_gestionnaire:
        # Pour une agence, on compte les locataires créés par tous les collaborateurs actifs
        from app.models.agence_membre import AgenceMembre, AgenceMembreStatus
        agence_id = active_agence_id(db, owner_id)
        if agence_id:
            gestionnaires = db.query(AgenceMembre.utilisateur_id).filter(AgenceMembre.agence_id == agence_id, AgenceMembre.statut == AgenceMembreStatus.ACTIF).all()
            creator_ids = [g[0] for g in gestionnaires]
        else:
            creator_ids = [owner_id]
    else:
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


def compute_proprietaire_usage(db: Session, proprietaire_id: int) -> dict:
    """Compte l'usage réel d'un propriétaire pour son propre abonnement (Owner)."""
    target_proprietaire_ids = [proprietaire_id]

    biens = db.query(Bien).filter(Bien.proprietaire_id.in_(target_proprietaire_ids), Bien.deleted_at.is_(None)).count()

    lots = (
        db.query(Lot)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(Bien.proprietaire_id.in_(target_proprietaire_ids), Bien.deleted_at.is_(None), Lot.deleted_at.is_(None))
        .count()
    )

    baux_actifs = (
        db.query(Bail)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id.in_(target_proprietaire_ids),
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
            Mandat.proprietaire_id == proprietaire_id,
            Mandat.deleted_at.is_(None),
            Mandat.statut == MandatStatus.ACTIF,
        )
        .count()
    )

    locataires = len(_counted_locataire_ids(db, proprietaire_id))

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    quittances_mois = (
        db.query(Quittance)
        .join(Paiement, Paiement.id == Quittance.paiement_id)
        .join(Echeance, Echeance.id == Paiement.echeance_id)
        .join(Bail, Bail.id == Echeance.bail_id)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id.in_(target_proprietaire_ids),
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
        "membres_agence": 0,
        "storage_mb": 0,
    }


def compute_agence_usage(db: Session, agence_id: int) -> dict:
    """Compte l'usage global d'une agence (via ses mandats actifs) pour son abonnement (Agency)."""
    
    from app.models.agence_membre import AgenceMembre, AgenceMembreStatus
    
    gestionnaires_ids = [
        row[0] for row in db.query(AgenceMembre.utilisateur_id)
        .filter(AgenceMembre.agence_id == agence_id, AgenceMembre.statut == AgenceMembreStatus.ACTIF)
        .all()
    ]
    
    target_proprietaire_ids = set()
    for g_id in gestionnaires_ids:
        target_proprietaire_ids.update(managed_proprietaire_ids(db, g_id))
        
    target_proprietaire_ids = list(target_proprietaire_ids)
    if not target_proprietaire_ids:
        target_proprietaire_ids = [-1]

    biens = db.query(Bien).filter(Bien.proprietaire_id.in_(target_proprietaire_ids), Bien.deleted_at.is_(None)).count()

    lots = (
        db.query(Lot)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(Bien.proprietaire_id.in_(target_proprietaire_ids), Bien.deleted_at.is_(None), Lot.deleted_at.is_(None))
        .count()
    )

    baux_actifs = (
        db.query(Bail)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id.in_(target_proprietaire_ids),
            Bien.deleted_at.is_(None),
            Lot.deleted_at.is_(None),
            Bail.deleted_at.is_(None),
            Bail.statut == BailStatus.ACTIF,
        )
        .count()
    )

    # Membres d'agence actifs
    membres_agence = len(gestionnaires_ids)
    
    # Locataires (on récupère les locataires créés par les gestionnaires ou liés aux baux)
    bail_linked_locataire_ids = {
        row[0]
        for row in db.query(Bail.locataire_id)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id.in_(target_proprietaire_ids),
            Bien.deleted_at.is_(None),
            Lot.deleted_at.is_(None),
            Bail.deleted_at.is_(None),
        )
        .distinct()
        .all()
    }
    created_locataire_ids = {
        row[0]
        for row in db.query(Utilisateur.id).filter(
            Utilisateur.role == UtilisateurRole.LOCATAIRE,
            Utilisateur.deleted_at.is_(None),
            Utilisateur.cree_par_id.in_(gestionnaires_ids),
        )
    }
    locataires = len(bail_linked_locataire_ids | created_locataire_ids)

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    quittances_mois = (
        db.query(Quittance)
        .join(Paiement, Paiement.id == Quittance.paiement_id)
        .join(Echeance, Echeance.id == Paiement.echeance_id)
        .join(Bail, Bail.id == Echeance.bail_id)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(
            Bien.proprietaire_id.in_(target_proprietaire_ids),
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
        "gestionnaires": 0, # Uniquement pour les abonnements PROPRIETAIRE
        "locataires": locataires,
        "quittances_mois": quittances_mois,
        "membres_agence": membres_agence,
        "storage_mb": 0, # Not implemented yet
    }

# Rétrocompatibilité pour les appels non modifiés dans usage_service
def compute_owner_usage(db: Session, owner_id: int) -> dict:
    return compute_proprietaire_usage(db, owner_id)

_LIMIT_FIELDS = {
    "biens": ("max_biens", "biens"),
    "lots": ("max_lots", "lots"),
    "baux_actifs": ("max_baux_actifs", "baux actifs"),
    "gestionnaires": ("max_gestionnaires", "gestionnaires"),
    "locataires": ("max_locataires", "locataires"),
    "quittances_mois": ("max_quittances_mois", "quittances ce mois-ci"),
    "membres_agence": ("max_membres_agence", "membres d'agence"),
}


def enforce_limit(db: Session, current_user: Utilisateur, resource: str, target_proprietaire_id: int = None) -> None:
    """Vérifie les limites. Si `current_user` est GESTIONNAIRE, vérifie l'abonnement de son Agence.
    Sinon, vérifie l'abonnement du Propriétaire (`current_user` ou `target_proprietaire_id`)."""
    
    is_agence = current_user.role == UtilisateurRole.GESTIONNAIRE
    
    if is_agence:
        agence_id = active_agence_id(db, current_user.id)
        if not agence_id:
            return
        
        subscription = (
            db.query(Subscription)
            .filter(Subscription.agence_id == agence_id, Subscription.deleted_at.is_(None))
            .with_for_update()
            .first()
        )
    else:
        owner_id = target_proprietaire_id or current_user.id
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
            f"L'abonnement « {plan.name} » a expiré ou est suspendu. "
            "Renouvelez-le ou passez à un plan supérieur pour continuer."
        )
        
    field_name, label = _LIMIT_FIELDS[resource]
    limit = getattr(plan, field_name)
    if limit is None or limit < 0:
        return
        
    if is_agence:
        usage = compute_agence_usage(db, agence_id)
    else:
        usage = compute_proprietaire_usage(db, target_proprietaire_id or current_user.id)
        
    if usage[resource] >= limit:
        raise PaymentRequired(
            f"Limite du plan « {plan.name} » atteinte pour {label} ({limit}). "
            "Passez à un plan supérieur pour continuer."
        )
