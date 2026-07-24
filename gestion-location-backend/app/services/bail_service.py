from calendar import monthrange
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.api.deps import bien_ids_with_permission, has_permission_for_bien
from app.models.bail import Bail, BailStatus, FrequencePaiement
from app.models.bien import Bien
from app.models.echeance import Echeance, EcheanceStatus
from app.models.lot import Lot
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.bail import BailCreate, BailUpdate
from app.services.exceptions import BadRequest, Forbidden, NotFound

# Guard-rail: beyond 120 due-dates we let the schedule be completed manually
# via POST /due-dates rather than generating a huge batch (e.g. a daily
# frequency over a multi-year lease).
MAX_ECHEANCES_AUTO = 120


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, monthrange(year, month)[1])
    return date(year, month, day)


def _advance(d: date, frequence: FrequencePaiement) -> date:
    if frequence == FrequencePaiement.JOUR:
        return d + timedelta(days=1)
    if frequence == FrequencePaiement.SEMAINE:
        return d + timedelta(weeks=1)
    if frequence == FrequencePaiement.ANNEE:
        return _add_months(d, 12)
    return _add_months(d, 1)  # MOIS


def _generate_echeances(bail: Bail) -> list[Echeance]:
    """Generate a due-date schedule between date_debut and date_fin, stepped
    according to the lease's payment frequency, when both dates are known."""
    if not bail.date_debut or not bail.date_fin or bail.loyer is None:
        return []
    montant = bail.loyer + (bail.charges or 0)
    frequence = bail.frequence_paiement or FrequencePaiement.MOIS
    echeances: list[Echeance] = []
    current = bail.date_debut
    while current <= bail.date_fin:
        if len(echeances) >= MAX_ECHEANCES_AUTO:
            return []  # schedule too long — complete manually via POST /due-dates
        echeances.append(
            Echeance(bail_id=bail.id, date_echeance=current, montant_du=montant, statut=EcheanceStatus.IMPAYE)
        )
        current = _advance(current, frequence)
    return echeances


def _bien_for_bail(db: Session, bail: Bail) -> Bien:
    lot = db.get(Lot, bail.lot_id)
    return db.get(Bien, lot.bien_id)


def _can_view_bail(db: Session, user: Utilisateur, bail: Bail) -> bool:
    if user.role == UtilisateurRole.LOCATAIRE and user.id == bail.locataire_id:
        return True
    bien = _bien_for_bail(db, bail)
    return bool(bien) and has_permission_for_bien(db, user, bien, "VIEW_LEASE")


def list_baux(db: Session, current_user: Utilisateur, skip: int = 0, limit: int = 100) -> list[Bail]:
    query = db.query(Bail).filter(Bail.deleted_at.is_(None))
    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = (
            query.join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id == current_user.id, Lot.deleted_at.is_(None), Bien.deleted_at.is_(None))
        )
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        ids = bien_ids_with_permission(db, current_user.id, "VIEW_LEASE")
        if not ids:
            return []
        query = (
            query.join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.id.in_(ids), Lot.deleted_at.is_(None), Bien.deleted_at.is_(None))
        )
    elif current_user.role == UtilisateurRole.LOCATAIRE:
        query = query.filter(Bail.locataire_id == current_user.id)
    return query.offset(skip).limit(limit).all()


def get_bail(db: Session, current_user: Utilisateur, bail_id: int) -> Bail:
    bail = (
        db.query(Bail)
        .filter(Bail.id == bail_id, Bail.deleted_at.is_(None))
        .first()
    )
    if not bail:
        raise NotFound("Lease not found")
    if not _can_view_bail(db, current_user, bail):
        raise Forbidden("Not allowed to access this lease")
    return bail


def create_bail(db: Session, current_user: Utilisateur, bail_in: BailCreate) -> Bail:
    lot = db.get(Lot, bail_in.lot_id)
    if not lot:
        raise NotFound("Lot not found")
    bien = db.get(Bien, lot.bien_id)
    if not has_permission_for_bien(db, current_user, bien, "CREATE_LEASE"):
        raise Forbidden("Not allowed to create a lease for this lot")

    locataire = db.get(Utilisateur, bail_in.locataire_id)
    if not locataire or locataire.role != UtilisateurRole.LOCATAIRE:
        raise BadRequest("locataire_id must reference a locataire")

    bail = Bail(**bail_in.model_dump())
    db.add(bail)
    db.commit()
    db.refresh(bail)

    db.add_all(_generate_echeances(bail))
    db.commit()
    return bail


def update_bail(db: Session, current_user: Utilisateur, bail_id: int, bail_in: BailUpdate) -> Bail:
    bail = (
        db.query(Bail)
        .filter(Bail.id == bail_id, Bail.deleted_at.is_(None))
        .first()
    )
    if not bail:
        raise NotFound("Lease not found")
    bien = _bien_for_bail(db, bail)
    if not has_permission_for_bien(db, current_user, bien, "UPDATE_LEASE"):
        raise Forbidden("Not allowed to modify this lease")
    for field, value in bail_in.model_dump(exclude_unset=True).items():
        setattr(bail, field, value)
    db.commit()
    db.refresh(bail)
    return bail


def delete_bail(db: Session, current_user: Utilisateur, bail_id: int) -> None:
    bail = (
        db.query(Bail)
        .filter(Bail.id == bail_id, Bail.deleted_at.is_(None))
        .first()
    )
    if not bail:
        raise NotFound("Lease not found")
    bien = _bien_for_bail(db, bail)
    if not has_permission_for_bien(db, current_user, bien, "DELETE_LEASE"):
        raise Forbidden("Not allowed to delete this lease")
    if bail.statut == BailStatus.ACTIF:
        raise BadRequest("Impossible de supprimer ce bail : il est actif. Terminez-le ou résiliez-le d'abord.")
    bail.deleted_at = datetime.utcnow()
    db.commit()
