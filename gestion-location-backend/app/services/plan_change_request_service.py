from sqlalchemy.orm import Session

from app.crud import subscription_plan as subscription_plan_crud
from app.models.notification import NotificationType
from app.models.plan_change_request import PlanChangeRequest, PlanChangeRequestStatus
from app.models.utilisateur import Utilisateur
from app.schemas.plan_change_request import PlanChangeRequestCreate
from app.services import subscription_service
from app.services.exceptions import BadRequest, NotFound
from app.services.push_service import notify_admins, send_push_to_user


def create_request(
    db: Session, current_user: Utilisateur, request_in: PlanChangeRequestCreate
) -> PlanChangeRequest:
    plan = subscription_plan_crud.get(db, request_in.plan_id)
    if not plan or not plan.is_active:
        raise BadRequest("Plan not found or inactive")

    # Un seul choix "en attente" à la fois par propriétaire : re-soumettre met à
    # jour la demande existante plutôt que d'en empiler une deuxième — l'admin ne
    # doit voir qu'un seul choix courant par compte.
    request = (
        db.query(PlanChangeRequest)
        .filter(
            PlanChangeRequest.owner_id == current_user.id,
            PlanChangeRequest.statut == PlanChangeRequestStatus.EN_ATTENTE,
        )
        .first()
    )
    if request:
        request.plan_id = plan.id
        request.message = request_in.message
    else:
        request = PlanChangeRequest(owner_id=current_user.id, plan_id=plan.id, message=request_in.message)
        db.add(request)

    db.commit()
    db.refresh(request)

    notify_admins(
        db,
        title="Nouvelle demande de changement de plan",
        body=f"{current_user.prenom} {current_user.nom} souhaite passer au plan « {plan.name} ».",
        notif_type=NotificationType.PLAN_CHANGE_REQUEST,
        reference_id=request.id,
    )
    return request


def get_my_pending_request(db: Session, current_user: Utilisateur) -> PlanChangeRequest | None:
    return (
        db.query(PlanChangeRequest)
        .filter(
            PlanChangeRequest.owner_id == current_user.id,
            PlanChangeRequest.statut == PlanChangeRequestStatus.EN_ATTENTE,
        )
        .order_by(PlanChangeRequest.date_creation.desc())
        .first()
    )


def list_requests(db: Session) -> list[PlanChangeRequest]:
    return db.query(PlanChangeRequest).order_by(PlanChangeRequest.date_creation.desc()).all()


def approve_request(db: Session, request_id: int) -> PlanChangeRequest:
    """Applique le choix du propriétaire : assigne le plan demandé (même chemin
    que l'assignation manuelle depuis /backoffice/admin/abonnements) et notifie
    le propriétaire que c'est fait."""
    request = db.get(PlanChangeRequest, request_id)
    if not request:
        raise NotFound("Request not found")
    plan = subscription_plan_crud.get(db, request.plan_id)
    if not plan:
        raise NotFound("Plan not found")

    subscription_service.assign_plan(db, request.owner_id, plan)

    request.statut = PlanChangeRequestStatus.APPROUVEE
    db.commit()
    db.refresh(request)

    send_push_to_user(
        db,
        user_id=request.owner_id,
        title="Votre abonnement a été mis à jour",
        body=f"Le plan « {plan.name} » a été activé sur votre compte.",
        notif_type=NotificationType.PLAN_CHANGE_REQUEST,
        reference_id=request.id,
    )
    return request


def reject_request(db: Session, request_id: int) -> PlanChangeRequest:
    request = db.get(PlanChangeRequest, request_id)
    if not request:
        raise NotFound("Request not found")
    plan = subscription_plan_crud.get(db, request.plan_id)

    request.statut = PlanChangeRequestStatus.REJETEE
    db.commit()
    db.refresh(request)

    send_push_to_user(
        db,
        user_id=request.owner_id,
        title="Demande de changement de plan refusée",
        body=(
            f"Votre demande de passage au plan « {plan.name} » a été refusée. Contactez-nous pour en savoir plus."
            if plan
            else "Votre demande de changement de plan a été refusée. Contactez-nous pour en savoir plus."
        ),
        notif_type=NotificationType.PLAN_CHANGE_REQUEST,
        reference_id=request.id,
    )
    return request
