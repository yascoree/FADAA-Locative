import secrets
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import active_agence_id
from app.core.config import settings
from app.core.security import create_password_reset_token, hash_password
from app.models.agence import Agence
from app.models.agence_membre import AgenceMembre, AgenceMembreStatus, RoleAgence
from app.models.invitation_client import InvitationClient, InvitationClientStatus
from app.models.mandat import Mandat, MandatStatus
from app.models.notification import NotificationType
from app.models.utilisateur import StatutCompte, Utilisateur, UtilisateurRole
from app.schemas.invitation_client import InvitationClientCreate
from app.services import subscription_service
from app.services.email_service import send_email
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.push_service import send_push_to_user

# Au-delà de ce délai, une invitation EN_ATTENTE est traitée comme EXPIREE — pas
# de tâche planifiée dans ce projet, donc calculé à la volée à chaque lecture
# (voir _sweep_expired) plutôt que par un job cron dédié.
INVITATION_EXPIRY_DAYS = 14


def _require_admin_membre(db: Session, current_user: Utilisateur) -> int:
    agence_id = active_agence_id(db, current_user.id)
    if agence_id is None:
        raise BadRequest("You are not a member of any agence")
    membre = (
        db.query(AgenceMembre)
        .filter(
            AgenceMembre.agence_id == agence_id,
            AgenceMembre.utilisateur_id == current_user.id,
            AgenceMembre.statut == AgenceMembreStatus.ACTIF,
        )
        .first()
    )
    if not membre or membre.role_agence != RoleAgence.ADMIN:
        raise Forbidden("Only an agence admin can do this")
    return agence_id


def _sweep_expired(db: Session, invitations: list[InvitationClient]) -> list[InvitationClient]:
    """Bascule en EXPIREE (et persiste) toute invitation EN_ATTENTE plus vieille
    que INVITATION_EXPIRY_DAYS, à chaque fois qu'un lot est lu — voir la note sur
    INVITATION_EXPIRY_DAYS ci-dessus pour pourquoi ce n'est pas un job planifié."""
    cutoff = datetime.utcnow() - timedelta(days=INVITATION_EXPIRY_DAYS)
    dirty = False
    for inv in invitations:
        if inv.statut == InvitationClientStatus.EN_ATTENTE and inv.created_at < cutoff:
            inv.statut = InvitationClientStatus.EXPIREE
            dirty = True
    if dirty:
        db.commit()
    return invitations


def expire_pending_invitations(db: Session) -> int:
    """Bascule en EXPIREE toute invitation EN_ATTENTE au-delà de
    INVITATION_EXPIRY_DAYS. Tourne quotidiennement aux côtés des autres tâches
    planifiées (voir app.scheduler) — _sweep_expired reste aussi appelé à la
    lecture/l'action pour rester cohérent entre deux passages de cette tâche."""
    cutoff = datetime.utcnow() - timedelta(days=INVITATION_EXPIRY_DAYS)
    overdue = (
        db.query(InvitationClient)
        .filter(InvitationClient.statut == InvitationClientStatus.EN_ATTENTE, InvitationClient.created_at < cutoff)
        .all()
    )
    for inv in overdue:
        inv.statut = InvitationClientStatus.EXPIREE
    db.commit()
    return len(overdue)


def create_invitation(
    db: Session, current_user: Utilisateur, payload: InvitationClientCreate
) -> tuple[InvitationClient, str | None]:
    """Réservé à un membre ADMIN de son agence. Résout ou crée le compte
    propriétaire ciblé, puis crée l'invitation EN_ATTENTE — jamais de Mandat ici,
    voir app.models.invitation_client. Le Mandat n'existera qu'une fois
    l'invitation acceptée, configuré par le propriétaire lui-même comme dans le
    flux "agence existante" déjà en place."""
    agence_id = _require_admin_membre(db, current_user)

    email = payload.email.strip().lower()
    existing_pending = (
        db.query(InvitationClient)
        .filter(
            InvitationClient.agence_id == agence_id,
            InvitationClient.statut == InvitationClientStatus.EN_ATTENTE,
        )
        .join(Utilisateur, Utilisateur.id == InvitationClient.proprietaire_id)
        .filter(func.lower(Utilisateur.email) == email)
        .first()
    )
    if existing_pending:
        raise BadRequest("An invitation is already pending for this email")

    # Comparaison insensible à la casse : l'agence peut taper l'email différemment
    # de la casse d'origine utilisée à l'inscription du propriétaire.
    target = db.query(Utilisateur).filter(func.lower(Utilisateur.email) == email).first()
    invite_link = None
    is_new_account = target is None

    if target is not None and target.role != UtilisateurRole.PROPRIETAIRE:
        raise BadRequest("This email belongs to an account that isn't a property owner")

    if target is None:
        # Aucun nom n'est collecté à l'invitation (voir InvitationClient) — l'email
        # est la seule information connue. nom/prenom ne peuvent pas rester vides
        # (UtilisateurRead exige min_length=1) ; le propriétaire les met à jour
        # lui-même dans Paramètres une fois son compte activé.
        placeholder_name = email.split("@")[0]
        target = Utilisateur(
            nom=placeholder_name,
            prenom=placeholder_name,
            email=email,
            mot_de_passe=hash_password(secrets.token_urlsafe(24)),
            role=UtilisateurRole.PROPRIETAIRE,
            statut_compte=StatutCompte.INVITE_EN_ATTENTE,
            cree_par_id=current_user.id,
        )
        db.add(target)
        db.commit()
        db.refresh(target)
        # Même règle qu'à l'auto-inscription (voir auth_service.register) : un
        # propriétaire démarre toujours avec un essai gratuit actif.
        subscription_service.create_trial_subscription(db, target.id)
    else:
        already_client = (
            db.query(InvitationClient)
            .filter(
                InvitationClient.agence_id == agence_id,
                InvitationClient.proprietaire_id == target.id,
                InvitationClient.statut == InvitationClientStatus.ACCEPTEE,
            )
            .first()
        )
        already_has_mandat = (
            db.query(Mandat)
            .filter(Mandat.agence_id == agence_id, Mandat.proprietaire_id == target.id, Mandat.statut == MandatStatus.ACTIF)
            .first()
        )
        if already_client or already_has_mandat:
            raise BadRequest("This owner is already one of your clients")

    invitation = InvitationClient(
        agence_id=agence_id,
        proprietaire_id=target.id,
        email=email,
        statut=InvitationClientStatus.EN_ATTENTE,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    agence = db.get(Agence, agence_id)

    if is_new_account:
        token = create_password_reset_token(target.id, target.mot_de_passe)
        invite_link = f"{settings.frontend_base_url}/front/reset-password?token={token}"
        html_body = f"""
        <p>Bonjour,</p>
        <p>{agence.nom} vous invite à devenir client sur FADAA Locative pour la gestion de vos biens.</p>
        <p>Choisissez votre mot de passe pour créer votre compte et répondre à cette invitation
        (lien valable {settings.password_reset_token_expire_minutes} minutes) :</p>
        <p><a href="{invite_link}">{invite_link}</a></p>
        """
        sent = send_email(target.email, f"{agence.nom} vous invite sur FADAA Locative", html_body)
        if sent:
            invite_link = None
    else:
        html_body = f"""
        <p>Bonjour {target.prenom},</p>
        <p>{agence.nom} vous invite à devenir client sur FADAA Locative pour la gestion de vos biens.</p>
        <p>Connectez-vous à votre compte pour accepter ou refuser cette invitation.</p>
        """
        send_email(target.email, f"{agence.nom} vous invite sur FADAA Locative", html_body)
        send_push_to_user(
            db,
            user_id=target.id,
            title="Nouvelle invitation d'agence",
            body=f"{agence.nom} souhaite gérer vos biens.",
            notif_type=NotificationType.INVITATION_CLIENT,
            reference_id=invitation.id,
        )

    return invitation, invite_link


def list_invitations_for_agence(db: Session, current_user: Utilisateur) -> list[InvitationClient]:
    agence_id = active_agence_id(db, current_user.id)
    if agence_id is None:
        raise BadRequest("You are not a member of any agence")
    invitations = (
        db.query(InvitationClient)
        .filter(InvitationClient.agence_id == agence_id)
        .order_by(InvitationClient.created_at.desc())
        .all()
    )
    return _sweep_expired(db, invitations)


def list_invitations_for_proprietaire(db: Session, current_user: Utilisateur) -> list[InvitationClient]:
    invitations = (
        db.query(InvitationClient)
        .filter(InvitationClient.proprietaire_id == current_user.id)
        .order_by(InvitationClient.created_at.desc())
        .all()
    )
    return _sweep_expired(db, invitations)


def _get_own_pending_invitation(db: Session, current_user: Utilisateur, invitation_id: int) -> InvitationClient:
    invitation = db.get(InvitationClient, invitation_id)
    if not invitation:
        raise NotFound("Invitation not found")
    if invitation.proprietaire_id != current_user.id:
        raise Forbidden("This invitation isn't addressed to you")
    _sweep_expired(db, [invitation])
    if invitation.statut != InvitationClientStatus.EN_ATTENTE:
        raise BadRequest("This invitation has already been answered or has expired")
    return invitation


def accept_invitation(db: Session, current_user: Utilisateur, invitation_id: int) -> InvitationClient:
    invitation = _get_own_pending_invitation(db, current_user, invitation_id)
    invitation.statut = InvitationClientStatus.ACCEPTEE
    invitation.responded_at = datetime.utcnow()
    db.commit()
    db.refresh(invitation)
    return invitation


def decline_invitation(db: Session, current_user: Utilisateur, invitation_id: int) -> InvitationClient:
    invitation = _get_own_pending_invitation(db, current_user, invitation_id)
    invitation.statut = InvitationClientStatus.REFUSEE
    invitation.responded_at = datetime.utcnow()
    db.commit()
    db.refresh(invitation)
    return invitation


def cancel_invitation(db: Session, current_user: Utilisateur, invitation_id: int) -> InvitationClient:
    """Côté agence : retire une invitation encore EN_ATTENTE (ex: email mal
    saisi). Se résout dans le même statut REFUSEE qu'un refus du propriétaire —
    pas d'état "annulée" séparé, cohérent avec les 4 statuts exposés à l'agence
    (En attente / Acceptée / Refusée / Expirée)."""
    agence_id = _require_admin_membre(db, current_user)
    invitation = db.get(InvitationClient, invitation_id)
    if not invitation or invitation.agence_id != agence_id:
        raise NotFound("Invitation not found")
    if invitation.statut != InvitationClientStatus.EN_ATTENTE:
        raise BadRequest("This invitation has already been answered or has expired")
    invitation.statut = InvitationClientStatus.REFUSEE
    invitation.responded_at = datetime.utcnow()
    db.commit()
    db.refresh(invitation)
    return invitation
