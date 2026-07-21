from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.discussion import Discussion
from app.models.utilisateur import Utilisateur, UtilisateurRole
from app.schemas.discussion import DiscussionCreate, DiscussionRead, DiscussionUpdate

router = APIRouter(prefix="/discussions", tags=["discussions"])


def _ensure_owner_or_admin(current_user: Utilisateur, discussion: Discussion) -> None:
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and current_user.id != discussion.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this discussion")


@router.get("/", response_model=list[DiscussionRead])
def list_discussions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Discussion)
    if current_user.role != UtilisateurRole.ADMINISTRATEUR:
        query = query.filter(Discussion.user_id == current_user.id)
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=DiscussionRead, status_code=status.HTTP_201_CREATED)
def create_discussion(
    discussion_in: DiscussionCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if current_user.role != UtilisateurRole.ADMINISTRATEUR and discussion_in.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create a discussion for another user"
        )

    discussion = Discussion(**discussion_in.model_dump())
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
    _ensure_owner_or_admin(current_user, discussion)
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
    _ensure_owner_or_admin(current_user, discussion)

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
    _ensure_owner_or_admin(current_user, discussion)
    db.delete(discussion)
    db.commit()
