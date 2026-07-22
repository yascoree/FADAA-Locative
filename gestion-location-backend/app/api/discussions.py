from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, managed_proprietaire_ids
from app.database import get_db
from app.models.bail import Bail
from app.models.bien import Bien
from app.models.discussion import Discussion
from app.models.lot import Lot
from app.models.mandat import Mandat
from app.models.reclamation import Reclamation, ReclamationStatus
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.discussion import DiscussionCreate, DiscussionRead, DiscussionUpdate

router = APIRouter(prefix="/discussions", tags=["discussions"])


def _ensure_participant_or_admin(current_user: Utilisateur, discussion: Discussion) -> None:
    if current_user.role == UtilisateurRole.ADMINISTRATEUR:
        return
    if current_user.id not in (discussion.user_id, discussion.destinataire_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this discussion")


def _ensure_sender_or_admin(current_user: Utilisateur, discussion: Discussion) -> None:
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != discussion.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this discussion")


def _is_legitimate_contact(db: Session, current_user: Utilisateur, destinataire: Utilisateur) -> bool:
    """Un message ne peut être envoyé qu'à quelqu'un avec qui l'expéditeur a une
    relation réelle dans l'app (bail ou mandat) — pas à n'importe quel utilisateur."""
    if current_user.role == UtilisateurRole.ADMINISTRATEUR:
        return True

    # Un propriétaire ne peut discuter librement avec l'admin qu'après qu'une de
    # ses réclamations a été acceptée — c'est le seul point d'entrée (voir
    # app/api/reclamations.py). Tant qu'aucune n'est acceptée, pas de messagerie
    # libre vers l'admin.
    if destinataire.role == UtilisateurRole.ADMINISTRATEUR:
        if current_user.role != UtilisateurRole.PROPRIETAIRE:
            return False
        return (
            db.query(Reclamation)
            .filter(
                Reclamation.proprietaire_id == current_user.id,
                Reclamation.statut == ReclamationStatus.ACCEPTEE,
            )
            .first()
            is not None
        )

    if current_user.role == UtilisateurRole.PROPRIETAIRE:
        if destinataire.role == UtilisateurRole.LOCATAIRE:
            return (
                db.query(Bail)
                .join(Lot, Lot.id == Bail.lot_id)
                .join(Bien, Bien.id == Lot.bien_id)
                .filter(Bien.proprietaire_id == current_user.id, Bail.locataire_id == destinataire.id)
                .first()
                is not None
            )
        if destinataire.role == UtilisateurRole.GESTIONNAIRE:
            return (
                db.query(Mandat)
                .filter(Mandat.proprietaire_id == current_user.id, Mandat.gestionnaire_id == destinataire.id)
                .first()
                is not None
            )
        return False

    if current_user.role == UtilisateurRole.LOCATAIRE:
        if destinataire.role != UtilisateurRole.PROPRIETAIRE:
            return False
        return (
            db.query(Bail)
            .join(Lot, Lot.id == Bail.lot_id)
            .join(Bien, Bien.id == Lot.bien_id)
            .filter(Bail.locataire_id == current_user.id, Bien.proprietaire_id == destinataire.id)
            .first()
            is not None
        )

    if current_user.role == UtilisateurRole.GESTIONNAIRE:
        if destinataire.role == UtilisateurRole.PROPRIETAIRE:
            return (
                db.query(Mandat)
                .filter(Mandat.gestionnaire_id == current_user.id, Mandat.proprietaire_id == destinataire.id)
                .first()
                is not None
            )
        if destinataire.role == UtilisateurRole.LOCATAIRE:
            ids = managed_proprietaire_ids(db, current_user.id)
            if not ids:
                return False
            return (
                db.query(Bail)
                .join(Lot, Lot.id == Bail.lot_id)
                .join(Bien, Bien.id == Lot.bien_id)
                .filter(Bien.proprietaire_id.in_(ids), Bail.locataire_id == destinataire.id)
                .first()
                is not None
            )
        return False

    return False


@router.get("/", response_model=list[DiscussionRead])
def list_discussions(
    skip: int = 0,
    limit: int = 200,
    with_user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Messages envoyés OU reçus par l'utilisateur courant (une vraie messagerie,
    pas seulement ses propres messages). Scopé à l'utilisateur courant même pour un
    admin : chaque conversation reste privée entre ses deux participants, l'admin
    n'a pas de vue globale sur les échanges des autres. with_user_id restreint à la
    conversation avec un participant précis."""
    query = db.query(Discussion).filter(
        or_(Discussion.user_id == current_user.id, Discussion.destinataire_id == current_user.id)
    )
    if with_user_id is not None:
        query = query.filter(
            or_(
                (Discussion.user_id == current_user.id) & (Discussion.destinataire_id == with_user_id),
                (Discussion.user_id == with_user_id) & (Discussion.destinataire_id == current_user.id),
            )
        )
    return query.order_by(Discussion.date_sent.asc()).offset(skip).limit(limit).all()


@router.post("/", response_model=DiscussionRead, status_code=status.HTTP_201_CREATED)
def create_discussion(
    discussion_in: DiscussionCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    destinataire = db.get(Utilisateur, discussion_in.destinataire_id)
    if not destinataire:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")
    if not _is_legitimate_contact(db, current_user, destinataire):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot message this user")

    discussion = Discussion(
        user_id=current_user.id,
        destinataire_id=discussion_in.destinataire_id,
        message=discussion_in.message,
        pdf=discussion_in.pdf,
    )
    db.add(discussion)
    db.commit()
    db.refresh(discussion)
    return discussion


@router.get("/{discussion_id}", response_model=DiscussionRead)
def get_discussion(
    discussion_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    discussion = db.get(Discussion, discussion_id)
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")
    _ensure_participant_or_admin(current_user, discussion)
    return discussion


@router.put("/{discussion_id}", response_model=DiscussionRead)
def update_discussion(
    discussion_id: int,
    discussion_in: DiscussionUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    discussion = db.get(Discussion, discussion_id)
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")
    _ensure_sender_or_admin(current_user, discussion)

    for field, value in discussion_in.model_dump(exclude_unset=True).items():
        setattr(discussion, field, value)

    db.commit()
    db.refresh(discussion)
    return discussion


@router.delete("/{discussion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discussion(
    discussion_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    discussion = db.get(Discussion, discussion_id)
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")
    _ensure_sender_or_admin(current_user, discussion)
    db.delete(discussion)
    db.commit()
