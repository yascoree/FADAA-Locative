from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.discussion import Discussion
from app.schemas.discussion import DiscussionCreate, DiscussionRead, DiscussionUpdate

router = APIRouter(prefix="/discussions", tags=["discussions"])


@router.get("/", response_model=list[DiscussionRead])
def list_discussions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Discussion).offset(skip).limit(limit).all()


@router.post("/", response_model=DiscussionRead, status_code=status.HTTP_201_CREATED)
def create_discussion(discussion_in: DiscussionCreate, db: Session = Depends(get_db)):
    discussion = Discussion(**discussion_in.model_dump())
    db.add(discussion)
    db.commit()
    db.refresh(discussion)
    return discussion


@router.get("/{discussion_id}", response_model=DiscussionRead)
def get_discussion(discussion_id: int, db: Session = Depends(get_db)):
    discussion = db.get(Discussion, discussion_id)
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")
    return discussion


@router.put("/{discussion_id}", response_model=DiscussionRead)
def update_discussion(discussion_id: int, discussion_in: DiscussionUpdate, db: Session = Depends(get_db)):
    discussion = db.get(Discussion, discussion_id)
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")

    for field, value in discussion_in.model_dump(exclude_unset=True).items():
        setattr(discussion, field, value)

    db.commit()
    db.refresh(discussion)
    return discussion


@router.delete("/{discussion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discussion(discussion_id: int, db: Session = Depends(get_db)):
    discussion = db.get(Discussion, discussion_id)
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")
    db.delete(discussion)
    db.commit()
