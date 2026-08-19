from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.schemas.blog_post import BlogPostCreate, BlogPostRead, BlogPostUpdate
from app.services import blog_post_service
from app.services.exceptions import BadRequest, NotFound

router = APIRouter(prefix="/blog", tags=["blog"])


@router.get("/posts", response_model=list[BlogPostRead])
def list_published_posts(db: Session = Depends(get_db)):
    """Public : uniquement les articles publiés."""
    return blog_post_service.list_published(db)


@router.get("/posts/{slug}", response_model=BlogPostRead)
def get_published_post(slug: str, db: Session = Depends(get_db)):
    try:
        return blog_post_service.get_published_by_slug(db, slug)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get("/admin/posts", response_model=list[BlogPostRead])
def list_all_posts(db: Session = Depends(get_db), current_user: Utilisateur = Depends(require_admin)):
    return blog_post_service.list_all(db)


@router.get("/admin/posts/{post_id}", response_model=BlogPostRead)
def get_post(post_id: int, db: Session = Depends(get_db), current_user: Utilisateur = Depends(require_admin)):
    try:
        return blog_post_service.get_by_id(db, post_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/admin/posts", response_model=BlogPostRead, status_code=status.HTTP_201_CREATED)
def create_post(
    post_in: BlogPostCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    try:
        return blog_post_service.create_post(db, current_user, post_in)
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.put("/admin/posts/{post_id}", response_model=BlogPostRead)
def update_post(
    post_id: int,
    post_in: BlogPostUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    try:
        return blog_post_service.update_post(db, post_id, post_in)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/admin/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, db: Session = Depends(get_db), current_user: Utilisateur = Depends(require_admin)):
    try:
        blog_post_service.delete_post(db, post_id)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/admin/posts/{post_id}/cover", response_model=BlogPostRead)
async def upload_cover_image(
    post_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    content = await file.read()
    try:
        return blog_post_service.upload_cover_image(db, post_id, content, file.content_type)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/admin/posts/{post_id}/images")
async def upload_inline_image(
    post_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    content = await file.read()
    try:
        url = blog_post_service.upload_inline_image(db, post_id, content, file.content_type)
    except NotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except BadRequest as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {"url": url}
