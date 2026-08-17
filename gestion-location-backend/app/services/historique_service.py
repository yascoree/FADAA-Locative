from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import Session

from app.models.agence import Agence
from app.models.avis import Avis
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.categorie import Categorie
from app.models.discussion import Discussion
from app.models.echeance import Echeance
from app.models.historique import Historique
from app.models.lot import Lot
from app.models.mandat import Mandat
from app.models.notification import Notification
from app.models.paiement import Paiement
from app.models.partenaire import Partenaire
from app.models.permission import Permission
from app.models.profil import Profil
from app.models.quittance import Quittance
from app.models.reclamation import Reclamation
from app.models.subscription import Subscription
from app.models.subscription_plan import SubscriptionPlan
from app.models.utilisateur import Utilisateur


def _user_label(u: Utilisateur) -> str:
    return f"{u.prenom} {u.nom}".strip()


def _bail_label(b: Bail) -> str:
    locataire = f"{b.locataire.prenom} {b.locataire.nom}" if b.locataire else None
    lot = b.lot.reference if b.lot and b.lot.reference else None
    if locataire and lot:
        return f"{locataire} — {lot}"
    return locataire or lot


def _paiement_label(p: Paiement) -> Optional[str]:
    if p.montant is None:
        return None
    date = p.date_paiement.strftime("%d/%m/%Y") if p.date_paiement else ""
    return f"{p.montant} MAD — {date}".strip(" —")


def _quittance_label(q: Quittance) -> Optional[str]:
    if q.paiement and q.paiement.montant is not None:
        return f"Quittance — {q.paiement.montant} MAD"
    return None


def _mandat_label(m: Mandat) -> Optional[str]:
    agence = m.agence.nom if m.agence else None
    proprietaire = f"{m.proprietaire.prenom} {m.proprietaire.nom}" if m.proprietaire else None
    if agence and proprietaire:
        return f"{agence} → {proprietaire}"
    return agence or proprietaire


def _subscription_label(s: Subscription) -> Optional[str]:
    owner = f"{s.owner.prenom} {s.owner.nom}" if s.owner else None
    plan = s.plan.name if s.plan else None
    if owner and plan:
        return f"{owner} — {plan}"
    return owner or plan


def _notification_label(n: Notification) -> Optional[str]:
    return n.titre or None


def _discussion_label(d: Discussion) -> Optional[str]:
    if d.message:
        text = d.message.strip()
        return text[:40] + ("…" if len(text) > 40 else "")
    return d.piece_jointe_nom or None


def _echeance_label(e: Echeance) -> Optional[str]:
    if not e.date_echeance:
        return None
    return f"Échéance du {e.date_echeance.strftime('%d/%m/%Y')}"


MODULE_LABEL_MAP = {
    "properties": (Bien, lambda b: b.designation),
    "lots": (Lot, lambda l: l.reference),
    "leases": (Bail, _bail_label),
    "due-dates": (Echeance, _echeance_label),
    "payments": (Paiement, _paiement_label),
    "receipts": (Quittance, _quittance_label),
    "categories": (Categorie, lambda c: c.libelle),
    "users": (Utilisateur, _user_label),
    "tenants": (Utilisateur, _user_label),
    "mandates": (Mandat, _mandat_label),
    "agences": (Agence, lambda a: a.nom),
    "permissions": (Permission, lambda p: p.libelle),
    "profiles": (Profil, lambda p: None),
    "reviews": (Avis, lambda a: f"{a.prenom} {a.nom}".strip()),
    "partners": (Partenaire, lambda p: p.nom),
    "reclamations": (Reclamation, lambda r: r.sujet),
    "discussions": (Discussion, _discussion_label),
    "subscriptions": (Subscription, _subscription_label),
    "subscription-plans": (SubscriptionPlan, lambda s: s.name),
    "notifications": (Notification, _notification_label),
}


def _resolve_element_labels(db: Session, rows: list[Historique]) -> dict[tuple[str, int], str]:
    ids_by_module: dict[str, set[int]] = defaultdict(set)
    for row in rows:
        if row.element_id is not None and row.module in MODULE_LABEL_MAP:
            ids_by_module[row.module].add(row.element_id)

    labels: dict[tuple[str, int], str] = {}
    for module, ids in ids_by_module.items():
        model, label_fn = MODULE_LABEL_MAP[module]
        objs = db.query(model).filter(model.id.in_(ids)).all()
        for obj in objs:
            try:
                label = label_fn(obj)
            except Exception:
                label = None
            if label:
                labels[(module, obj.id)] = label
    return labels


def list_historique(
    db: Session,
    skip: int = 0,
    limit: int = 200,
    module: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
) -> list[Historique]:
    query = db.query(Historique)
    if module:
        query = query.filter(Historique.module == module)
    if action:
        query = query.filter(Historique.action == action)
    if user_id:
        query = query.filter(Historique.user_id == user_id)
    rows = query.order_by(Historique.created_at.desc()).offset(skip).limit(limit).all()

    labels = _resolve_element_labels(db, rows)
    for row in rows:
        row.element_label = labels.get((row.module, row.element_id)) if row.element_id is not None else None

    return rows
