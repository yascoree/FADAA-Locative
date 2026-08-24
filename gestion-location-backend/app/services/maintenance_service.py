from datetime import datetime

from sqlalchemy.orm import Session

from app.api.deps import bien_ids_with_permission, can_access_proprietaire, gestionnaire_ids_for_proprietaire, has_permission_for_bien
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.demande_maintenance import DemandeMaintenance, DemandeMaintenanceStatus
from app.models.lot import Lot
from app.models.notification import NotificationType
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.demande_maintenance import DemandeMaintenanceCreate, DemandeMaintenanceUpdate
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.push_service import send_push_to_user


def _chain_for_bail(db: Session, bail_id: int):
    bail = db.query(Bail).filter(Bail.id == bail_id, Bail.deleted_at.is_(None)).first()
    if not bail:
        return None, None
    lot = db.query(Lot).filter(Lot.id == bail.lot_id, Lot.deleted_at.is_(None)).first()
    bien = db.query(Bien).filter(Bien.id == lot.bien_id, Bien.deleted_at.is_(None)).first() if lot else None
    return bail, bien


def list_demandes(db: Session, current_user: Utilisateur, proprietaire_id: int | None = None) -> list[DemandeMaintenance]:
    if proprietaire_id is not None and not can_access_proprietaire(db, current_user, proprietaire_id):
        raise Forbidden("Not allowed to access this proprietaire")
    query = db.query(DemandeMaintenance).filter(DemandeMaintenance.deleted_at.is_(None))
    if current_user.role == UtilisateurRole.LOCATAIRE:
        query = query.filter(DemandeMaintenance.locataire_id == current_user.id)
    elif current_user.role == UtilisateurRole.PROPRIETAIRE:
        query = (
            query.join(Bail, Bail.id == DemandeMaintenance.bail_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.proprietaire_id == current_user.id, Bail.deleted_at.is_(None), Lot.deleted_at.is_(None))
        )
    elif current_user.role == UtilisateurRole.GESTIONNAIRE:
        # Réutilise VIEW_LEASE : une demande de maintenance est rattachée à un bail,
        # sans catalogue de permission dédié pour ce nouveau type de ressource.
        ids = bien_ids_with_permission(db, current_user.id, "VIEW_LEASE")
        if not ids:
            return []
        query = (
            query.join(Bail, Bail.id == DemandeMaintenance.bail_id)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bien.id.in_(ids), Bail.deleted_at.is_(None), Lot.deleted_at.is_(None))
        )
    if proprietaire_id is not None:
        if current_user.role == UtilisateurRole.LOCATAIRE:
            query = query.join(Bail, Bail.id == DemandeMaintenance.bail_id).join(Lot, Lot.id == Bail.lot_id).join(Bien, Bien.id == Lot.bien_id)
        query = query.filter(Bien.proprietaire_id == proprietaire_id, Bail.deleted_at.is_(None), Lot.deleted_at.is_(None), Bien.deleted_at.is_(None))
    return query.order_by(DemandeMaintenance.date_creation.desc()).all()


def get_demande(db: Session, current_user: Utilisateur, demande_id: int) -> DemandeMaintenance:
    demande = (
        db.query(DemandeMaintenance)
        .filter(DemandeMaintenance.id == demande_id, DemandeMaintenance.deleted_at.is_(None))
        .first()
    )
    if not demande:
        raise NotFound("Maintenance request not found")
    if current_user.role == UtilisateurRole.LOCATAIRE:
        if demande.locataire_id != current_user.id:
            raise Forbidden("Not allowed to access this maintenance request")
        return demande
    _, bien = _chain_for_bail(db, demande.bail_id)
    if not bien or not has_permission_for_bien(db, current_user, bien, "VIEW_LEASE"):
        raise Forbidden("Not allowed to access this maintenance request")
    return demande


def create_demande(
    db: Session, current_user: Utilisateur, demande_in: DemandeMaintenanceCreate
) -> DemandeMaintenance:
    bail, bien = _chain_for_bail(db, demande_in.bail_id)
    if not bail:
        raise NotFound("Lease not found")
    if bail.locataire_id != current_user.id:
        raise Forbidden("Not allowed to create a maintenance request for this lease")

    demande = DemandeMaintenance(
        bail_id=bail.id,
        locataire_id=current_user.id,
        titre=demande_in.titre,
        description=demande_in.description,
    )
    db.add(demande)
    db.commit()
    db.refresh(demande)

    if bien:
        stakeholder_ids = {bien.proprietaire_id, *gestionnaire_ids_for_proprietaire(db, bien.proprietaire_id)}
        for stakeholder_id in stakeholder_ids:
            send_push_to_user(
                db,
                user_id=stakeholder_id,
                title="Nouvelle demande de maintenance",
                body=f"{current_user.prenom} {current_user.nom} : {demande.titre}",
                notif_type=NotificationType.MAINTENANCE,
                reference_id=demande.id,
            )

    return demande


def update_demande(
    db: Session, current_user: Utilisateur, demande_id: int, demande_in: DemandeMaintenanceUpdate
) -> DemandeMaintenance:
    demande = (
        db.query(DemandeMaintenance)
        .filter(DemandeMaintenance.id == demande_id, DemandeMaintenance.deleted_at.is_(None))
        .first()
    )
    if not demande:
        raise NotFound("Maintenance request not found")
    _, bien = _chain_for_bail(db, demande.bail_id)
    if not bien or not has_permission_for_bien(db, current_user, bien, "UPDATE_LEASE"):
        raise Forbidden("Not allowed to update this maintenance request")
    if demande.statut in (DemandeMaintenanceStatus.RESOLUE, DemandeMaintenanceStatus.REJETEE):
        raise BadRequest("Cette demande est déjà clôturée.")

    update_data = demande_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(demande, field, value)
    if "statut" in update_data:
        demande.date_traitement = datetime.utcnow()
        demande.traite_par_id = current_user.id
    db.commit()
    db.refresh(demande)

    if "statut" in update_data:
        send_push_to_user(
            db,
            user_id=demande.locataire_id,
            title="Mise à jour de votre demande de maintenance",
            body=f"{demande.titre} — {current_user.prenom} {current_user.nom} a mis à jour le statut.",
            notif_type=NotificationType.MAINTENANCE,
            reference_id=demande.id,
        )

    return demande
