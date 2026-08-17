import secrets
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.api.deps import active_agence_id
from app.core.config import settings
from app.core.security import create_password_reset_token, hash_password
from app.models.agence import Agence
from app.models.agence_membre import AgenceMembre, AgenceMembreStatus, RoleAgence
from app.models.mandat import Mandat, MandatStatus
from app.models.utilisateur import StatutCompte, Utilisateur, UtilisateurRole
from app.schemas.agence import AgenceMembreInviteCreate, AgenceMembreUpdate
from app.services.email_service import send_email
from app.services.exceptions import BadRequest, Forbidden, NotFound


def get_my_agence(db: Session, current_user: Utilisateur) -> Optional[Agence]:
    agence_id = active_agence_id(db, current_user.id)
    if agence_id is None:
        return None
    return db.get(Agence, agence_id)


def _require_admin_membre(db: Session, current_user: Utilisateur, agence_id: int) -> AgenceMembre:
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
        raise Forbidden("Only an agence admin can manage its members")
    return membre


def list_agence_members(db: Session, current_user: Utilisateur, agence_id: int) -> list[AgenceMembre]:
    agence = db.get(Agence, agence_id)
    if not agence or agence.deleted_at is not None:
        raise NotFound("Agence not found")

    is_own_agence = current_user.role == UtilisateurRole.ADMINISTRATEUR or active_agence_id(
        db, current_user.id
    ) == agence_id
    is_mandating_proprietaire = False
    if not is_own_agence and current_user.role == UtilisateurRole.PROPRIETAIRE:
        # Un propriétaire peut voir l'équipe de toute agence avec laquelle il a un
        # mandat actif — pour savoir qui intervient sur son patrimoine.
        is_mandating_proprietaire = (
            db.query(Mandat)
            .filter(
                Mandat.agence_id == agence_id,
                Mandat.proprietaire_id == current_user.id,
                Mandat.statut == MandatStatus.ACTIF,
            )
            .first()
            is not None
        )
    if not is_own_agence and not is_mandating_proprietaire:
        raise Forbidden("Not allowed to view this agence's members")

    query = db.query(AgenceMembre).filter(AgenceMembre.agence_id == agence_id)
    if not is_own_agence:
        # Un propriétaire ne voit que l'équipe actuelle, pas l'historique des
        # anciens collaborateurs — ce n'est pertinent que pour la gestion interne
        # de l'agence elle-même.
        query = query.filter(AgenceMembre.statut == AgenceMembreStatus.ACTIF)
    return query.all()


def invite_agence_member(
    db: Session, current_member: Utilisateur, payload: AgenceMembreInviteCreate
) -> tuple[AgenceMembre, Optional[str]]:
    """Réservé à un membre ADMIN de son agence : crée un compte GESTIONNAIRE
    supplémentaire et l'ajoute directement comme membre actif — il hérite
    immédiatement de tous les mandats existants de l'agence, sans étape
    supplémentaire (voir app.api.deps.active_agence_id, qui résout l'accès par
    agence, jamais par utilisateur). Même mécanisme d'activation par mot de passe
    que create_gestionnaire_invite (rôle-agnostique)."""
    agence_id = active_agence_id(db, current_member.id)
    if agence_id is None:
        raise BadRequest("You are not a member of any agence")
    _require_admin_membre(db, current_member, agence_id)

    existing = db.query(Utilisateur).filter(Utilisateur.email == payload.email).first()
    if existing:
        raise BadRequest("Email already registered")

    utilisateur = Utilisateur(
        nom=payload.nom,
        prenom=payload.prenom,
        email=payload.email,
        mot_de_passe=hash_password(secrets.token_urlsafe(24)),
        role=UtilisateurRole.GESTIONNAIRE,
        statut_compte=StatutCompte.INVITE_EN_ATTENTE,
        cree_par_id=current_member.id,
    )
    db.add(utilisateur)
    db.commit()
    db.refresh(utilisateur)

    membre = AgenceMembre(
        agence_id=agence_id,
        utilisateur_id=utilisateur.id,
        role_agence=payload.role_agence,
        statut=AgenceMembreStatus.ACTIF,
        date_debut=datetime.utcnow().date(),
    )
    db.add(membre)
    db.commit()
    db.refresh(membre)

    token = create_password_reset_token(utilisateur.id, utilisateur.mot_de_passe)
    invite_link = f"{settings.frontend_base_url}/front/reset-password?token={token}"
    html_body = f"""
    <p>Bonjour {utilisateur.prenom},</p>
    <p>{current_member.prenom} {current_member.nom} vous a ajouté à son agence sur
    FADAA Locative.</p>
    <p>Choisissez votre mot de passe pour activer votre compte (lien valable
    {settings.password_reset_token_expire_minutes} minutes) :</p>
    <p><a href="{invite_link}">{invite_link}</a></p>
    """
    sent = send_email(utilisateur.email, "Votre accès collaborateur — FADAA Locative", html_body)

    return membre, (None if sent else invite_link)


def _get_active_membre(db: Session, agence_id: int, target_utilisateur_id: int) -> AgenceMembre:
    membre = (
        db.query(AgenceMembre)
        .filter(
            AgenceMembre.agence_id == agence_id,
            AgenceMembre.utilisateur_id == target_utilisateur_id,
            AgenceMembre.statut == AgenceMembreStatus.ACTIF,
        )
        .first()
    )
    if not membre:
        raise NotFound("Member not found")
    return membre


def _ensure_not_last_admin(db: Session, agence_id: int, membre: AgenceMembre, action: str) -> None:
    """Empêche de retirer le dernier ADMIN actif d'une agence — que ce soit en le
    révoquant ou en le rétrogradant MEMBRE, l'agence se retrouverait sinon sans
    personne habilité à gérer son équipe."""
    if membre.role_agence != RoleAgence.ADMIN:
        return
    other_admins = (
        db.query(AgenceMembre)
        .filter(
            AgenceMembre.agence_id == agence_id,
            AgenceMembre.role_agence == RoleAgence.ADMIN,
            AgenceMembre.statut == AgenceMembreStatus.ACTIF,
            AgenceMembre.id != membre.id,
        )
        .first()
    )
    if not other_admins:
        raise BadRequest(f"Cannot {action} the last admin of an agence")


def remove_agence_member(db: Session, current_member: Utilisateur, target_utilisateur_id: int) -> None:
    agence_id = active_agence_id(db, current_member.id)
    if agence_id is None:
        raise BadRequest("You are not a member of any agence")
    _require_admin_membre(db, current_member, agence_id)

    membre = _get_active_membre(db, agence_id, target_utilisateur_id)
    _ensure_not_last_admin(db, agence_id, membre, "remove")

    membre.statut = AgenceMembreStatus.REVOQUE
    membre.date_fin = datetime.utcnow().date()
    db.commit()


def update_agence_member(
    db: Session, current_member: Utilisateur, target_utilisateur_id: int, payload: AgenceMembreUpdate
) -> AgenceMembre:
    agence_id = active_agence_id(db, current_member.id)
    if agence_id is None:
        raise BadRequest("You are not a member of any agence")
    _require_admin_membre(db, current_member, agence_id)

    membre = _get_active_membre(db, agence_id, target_utilisateur_id)
    if payload.role_agence != RoleAgence.ADMIN:
        _ensure_not_last_admin(db, agence_id, membre, "demote")

    if payload.nom is not None or payload.prenom is not None:
        # Une fois le compte activé, seul son titulaire (ou un admin plateforme)
        # peut modifier son identité — voir utilisateur_service.update_utilisateur.
        if membre.utilisateur.statut_compte != StatutCompte.INVITE_EN_ATTENTE:
            raise BadRequest("Le nom et le prénom ne sont modifiables que tant que l'invitation est en attente")
        if payload.nom is not None:
            membre.utilisateur.nom = payload.nom
        if payload.prenom is not None:
            membre.utilisateur.prenom = payload.prenom

    membre.role_agence = payload.role_agence
    db.commit()
    db.refresh(membre)
    return membre
