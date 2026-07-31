from calendar import monthrange
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.api.deps import bien_ids_with_permission, has_permission_for_bien
from app.models.bail import Bail, BailStatus, FrequencePaiement
from app.models.bien import Bien
from app.models.echeance import Echeance, EcheanceStatus
from app.models.lot import Lot, LotStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.bail import BailCreate, BailUpdate
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.usage_service import enforce_limit

# Modifier ces champs romprait la cohérence avec des échéances déjà réglées
# (montants générés à partir de l'ancien loyer, dates hors de la nouvelle
# période) : verrouillés dès qu'un paiement existe sur une échéance du bail.
FIELDS_LOCKED_ONCE_PAID = {"date_debut", "date_fin", "loyer", "charges", "frequence_paiement"}

# Statuses that mean the lot is genuinely committed to a tenant for a period —
# used both to detect date-range conflicts and to decide whether a lot counts
# as occupied.
OCCUPYING_STATUSES = (BailStatus.ACTIF, BailStatus.EN_ATTENTE)


def _overlapping_bail(
    db: Session, lot_id: int, date_debut: date | None, date_fin: date | None, exclude_bail_id: int | None = None
) -> Bail | None:
    """Finds another active/planned bail on the same lot whose period overlaps
    the given range. A missing date_debut/date_fin is treated as unbounded
    (open start/open end), the conservative interpretation."""
    candidates = db.query(Bail).filter(
        Bail.lot_id == lot_id,
        Bail.deleted_at.is_(None),
        Bail.statut.in_(OCCUPYING_STATUSES),
    )
    if exclude_bail_id is not None:
        candidates = candidates.filter(Bail.id != exclude_bail_id)
    for existing in candidates.all():
        starts_before_or_eq = existing.date_debut is None or date_fin is None or existing.date_debut <= date_fin
        ends_after_or_eq = existing.date_fin is None or date_debut is None or date_debut <= existing.date_fin
        if starts_before_or_eq and ends_after_or_eq:
            return existing
    return None


def _sync_lot_statut(db: Session, lot: Lot) -> None:
    """Keeps Lot.statut in sync with its baux: ACTIF -> LOUE, EN_ATTENTE (futur/
    réservé) -> RESERVE, otherwise DISPONIBLE. Only toggles between those three —
    a manually-set EN_MAINTENANCE or HORS_SERVICE is left alone since it isn't
    tied to bail state."""
    if lot.statut in (LotStatus.EN_MAINTENANCE, LotStatus.HORS_SERVICE):
        return

    statuts = {
        statut
        for (statut,) in db.query(Bail.statut)
        .filter(Bail.lot_id == lot.id, Bail.deleted_at.is_(None), Bail.statut.in_(OCCUPYING_STATUSES))
        .all()
    }
    if BailStatus.ACTIF in statuts:
        target = LotStatus.LOUE
    elif BailStatus.EN_ATTENTE in statuts:
        target = LotStatus.RESERVE
    else:
        target = LotStatus.DISPONIBLE

    if lot.statut != target:
        lot.statut = target
        db.commit()


def expire_overdue_baux(db: Session) -> int:
    """Flips active baux past their date_fin to EXPIRE and re-syncs the
    affected lots. Meant to run daily alongside the other scheduled reminders."""
    today = date.today()
    overdue = (
        db.query(Bail)
        .filter(Bail.deleted_at.is_(None), Bail.statut == BailStatus.ACTIF, Bail.date_fin.isnot(None), Bail.date_fin < today)
        .all()
    )
    lot_ids = {bail.lot_id for bail in overdue}
    for bail in overdue:
        bail.statut = BailStatus.EXPIRE
    db.commit()
    for lot_id in lot_ids:
        lot = db.get(Lot, lot_id)
        if lot:
            _sync_lot_statut(db, lot)
    return len(overdue)

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
    # Beyond MAX_ECHEANCES_AUTO we stop and keep what's already built rather than
    # discarding the whole batch — the rest is completed manually via POST /due-dates.
    while current <= bail.date_fin and len(echeances) < MAX_ECHEANCES_AUTO:
        echeances.append(
            Echeance(bail_id=bail.id, date_echeance=current, montant_du=montant, statut=EcheanceStatus.IMPAYE)
        )
        current = _advance(current, frequence)
    return echeances


def _has_paid_echeances(db: Session, bail_id: int) -> bool:
    return (
        db.query(Echeance)
        .filter(
            Echeance.bail_id == bail_id,
            Echeance.deleted_at.is_(None),
            Echeance.statut.in_((EcheanceStatus.PAYE, EcheanceStatus.PARTIEL)),
        )
        .first()
        is not None
    )


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

    if bail_in.statut in OCCUPYING_STATUSES:
        conflict = _overlapping_bail(db, bail_in.lot_id, bail_in.date_debut, bail_in.date_fin)
        if conflict:
            raise BadRequest("Ce lot a déjà un bail actif ou planifié sur cette période.")

    if bail_in.statut == BailStatus.ACTIF:
        enforce_limit(db, bien.proprietaire_id, "baux_actifs")
    is_new_locataire = (
        db.query(Bail)
        .join(Lot, Lot.id == Bail.lot_id)
        .join(Bien, Bien.id == Lot.bien_id)
        .filter(Bien.proprietaire_id == bien.proprietaire_id, Bail.locataire_id == bail_in.locataire_id, Bail.deleted_at.is_(None))
        .first()
        is None
    )
    if is_new_locataire:
        enforce_limit(db, bien.proprietaire_id, "locataires")

    bail = Bail(**bail_in.model_dump())
    db.add(bail)
    db.commit()
    db.refresh(bail)

    db.add_all(_generate_echeances(bail))
    db.commit()
    _sync_lot_statut(db, lot)
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

    update_data = bail_in.model_dump(exclude_unset=True)
    prospective_statut = update_data.get("statut", bail.statut)
    prospective_date_fin = update_data.get("date_fin", bail.date_fin)
    if prospective_statut in OCCUPYING_STATUSES:
        conflict = _overlapping_bail(db, bail.lot_id, bail.date_debut, prospective_date_fin, exclude_bail_id=bail.id)
        if conflict:
            raise BadRequest("Ce lot a déjà un bail actif ou planifié sur cette période.")
    if prospective_statut == BailStatus.ACTIF and bail.statut != BailStatus.ACTIF:
        enforce_limit(db, bien.proprietaire_id, "baux_actifs")

    if FIELDS_LOCKED_ONCE_PAID & update_data.keys() and _has_paid_echeances(db, bail.id):
        raise BadRequest(
            "Impossible de modifier les dates, le loyer ou les charges de ce bail : "
            "des échéances ont déjà un paiement, cela rendrait l'historique incohérent."
        )

    for field, value in update_data.items():
        setattr(bail, field, value)
    db.commit()
    db.refresh(bail)
    lot = db.get(Lot, bail.lot_id)
    if lot:
        _sync_lot_statut(db, lot)
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
    if _has_paid_echeances(db, bail.id):
        raise BadRequest(
            "Impossible de supprimer ce bail : des échéances payées ou partiellement payées existent. "
            "L'historique financier doit être préservé."
        )
    bail.deleted_at = datetime.utcnow()
    db.commit()
    lot = db.get(Lot, bail.lot_id)
    if lot:
        _sync_lot_statut(db, lot)
