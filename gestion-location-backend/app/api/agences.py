from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import active_agence_id, get_current_user
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.agence import (
    AgenceMembreInviteCreate,
    AgenceMembreInviteRead,
    AgenceMembreRead,
    AgenceMembreUpdate,
    AgenceRead,
    AgenceClientRead,
)
from app.schemas.invitation_client import InvitationClientCreate, InvitationClientCreateResult, InvitationClientRead
from app.services import agence_service, invitation_client_service
from app.services.exceptions import BadRequest, Forbidden, NotFound
from app.services.subscription_service import SubscriptionError

router = APIRouter(prefix="/agences", tags=["agences"])


@router.get("/me", response_model=AgenceRead)
def get_my_agence(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    agence = agence_service.get_my_agence(db, current_user)
    if not agence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="You are not a member of any agence")
    return agence


@router.get("/me/clients", response_model=list[AgenceClientRead])
def list_my_clients(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Retourne la liste des propriétaires (clients) gérés par l'agence du
    current_user. L'accès est dérivé du membership actif (active_agence_id) via
    managed_proprietaire_ids — le frontend ne peut pas demander une agence_id
    arbitraire."""
    try:
        return agence_service.list_agence_clients(db, current_user)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/{agence_id}/membres", response_model=list[AgenceMembreRead])
def list_agence_members(
    agence_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return agence_service.list_agence_members(db, current_user, agence_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/{agence_id}/membres", response_model=AgenceMembreInviteRead, status_code=status.HTTP_201_CREATED)
def invite_agence_member(
    agence_id: int,
    payload: AgenceMembreInviteCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    """The path's agence_id must be the caller's own — agence_service always
    resolves the invite target from the caller's active membership, never from a
    client-supplied id, so this check only exists to make the URL's contract
    honest (403 rather than silently inviting into a different agence)."""
    if active_agence_id(db, current_user.id) != agence_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this agence")
    try:
        membre, invite_link = agence_service.invite_agence_member(db, current_user, payload)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return {"membre": membre, "invite_link": invite_link}


@router.patch("/{agence_id}/membres/{utilisateur_id}", response_model=AgenceMembreRead)
def update_agence_member(
    agence_id: int,
    utilisateur_id: int,
    payload: AgenceMembreUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if active_agence_id(db, current_user.id) != agence_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this agence")
    try:
        return agence_service.update_agence_member(db, current_user, utilisateur_id, payload)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete("/{agence_id}/membres/{utilisateur_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_agence_member(
    agence_id: int,
    utilisateur_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if active_agence_id(db, current_user.id) != agence_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this agence")
    try:
        agence_service.remove_agence_member(db, current_user, utilisateur_id)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ---------- Acquisition de clients (voir app.models.invitation_client) ----------


@router.get("/{agence_id}/invitations", response_model=list[InvitationClientRead])
def list_agence_invitations(
    agence_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if active_agence_id(db, current_user.id) != agence_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this agence")
    try:
        return invitation_client_service.list_invitations_for_agence(db, current_user)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{agence_id}/invitations", response_model=InvitationClientCreateResult, status_code=status.HTTP_201_CREATED)
def create_agence_invitation(
    agence_id: int,
    payload: InvitationClientCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if active_agence_id(db, current_user.id) != agence_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this agence")
    try:
        invitation, invite_link = invitation_client_service.create_invitation(db, current_user, payload)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except SubscriptionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {"invitation": invitation, "invite_link": invite_link}


@router.post("/{agence_id}/invitations/{invitation_id}/annuler", response_model=InvitationClientRead)
def cancel_agence_invitation(
    agence_id: int,
    invitation_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if active_agence_id(db, current_user.id) != agence_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this agence")
    try:
        return invitation_client_service.cancel_invitation(db, current_user, invitation_id)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
