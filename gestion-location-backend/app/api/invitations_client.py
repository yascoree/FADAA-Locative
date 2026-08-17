from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.invitation_client import InvitationClientRead
from app.services import invitation_client_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

router = APIRouter(prefix="/invitations-client", tags=["invitations-client"])


@router.get("/me", response_model=list[InvitationClientRead])
def list_my_invitations(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return invitation_client_service.list_invitations_for_proprietaire(db, current_user)


@router.post("/{invitation_id}/accepter", response_model=InvitationClientRead)
def accept_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return invitation_client_service.accept_invitation(db, current_user, invitation_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{invitation_id}/refuser", response_model=InvitationClientRead)
def decline_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return invitation_client_service.decline_invitation(db, current_user, invitation_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
