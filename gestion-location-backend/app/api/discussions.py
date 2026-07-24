from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.discussion import DiscussionCreate, DiscussionRead, DiscussionUpdate
from app.services import discussion_service
from app.services.exceptions import BadRequest, Forbidden, NotFound

router = APIRouter(prefix="/discussions", tags=["discussions"])


@router.get("/", response_model=list[DiscussionRead])
def list_discussions(
    skip: int = 0,
    limit: int = 200,
    with_user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return discussion_service.list_discussions(db, current_user, skip, limit, with_user_id)


@router.post("/", response_model=DiscussionRead, status_code=status.HTTP_201_CREATED)
def create_discussion(
    discussion_in: DiscussionCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return discussion_service.create_discussion(db, current_user, discussion_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/attachments")
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: Utilisateur = Depends(get_current_user),
):
    """Uploads a file (photo, PDF, document...) to attach to the next message sent —
    must be declared before /{discussion_id} to avoid being caught by that route."""
    content = await file.read()
    try:
        return discussion_service.upload_attachment(current_user, content, file.content_type, file.filename)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{discussion_id}", response_model=DiscussionRead)
def get_discussion(
    discussion_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return discussion_service.get_discussion(db, current_user, discussion_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.put("/{discussion_id}", response_model=DiscussionRead)
def update_discussion(
    discussion_id: int,
    discussion_in: DiscussionUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return discussion_service.update_discussion(db, current_user, discussion_id, discussion_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.delete("/{discussion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discussion(
    discussion_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        discussion_service.delete_discussion(db, current_user, discussion_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Forbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
