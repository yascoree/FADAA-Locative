import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import bleach
from sqlalchemy.orm import Session

from app.models.blog_post import BlogPost, BlogPostStatus
from app.models.utilisateur import Utilisateur
from app.schemas.blog_post import BlogPostCreate, BlogPostUpdate
from app.services.exceptions import BadRequest, NotFound

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "blog"
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB

ALLOWED_TAGS = ["p", "h1", "h2", "h3", "ul", "ol", "li", "a", "strong", "em", "blockquote", "img", "br"]
ALLOWED_ATTRS = {"a": ["href", "target", "rel"], "img": ["src", "alt"]}


def _sanitize(html: str) -> str:
    return bleach.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)


def _get_by_id(db: Session, post_id: int) -> BlogPost:
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.deleted_at.is_(None)).first()
    if not post:
        raise NotFound("Blog post not found")
    return post


def _check_slug_unique(db: Session, slug: str, exclude_id: Optional[int] = None) -> None:
    query = db.query(BlogPost).filter(BlogPost.slug == slug, BlogPost.deleted_at.is_(None))
    if exclude_id:
        query = query.filter(BlogPost.id != exclude_id)
    if query.first():
        raise BadRequest("A blog post with this slug already exists")


def list_published(db: Session) -> list[BlogPost]:
    return (
        db.query(BlogPost)
        .filter(BlogPost.statut == BlogPostStatus.PUBLISHED, BlogPost.deleted_at.is_(None))
        .order_by(BlogPost.published_at.desc())
        .all()
    )


def get_published_by_slug(db: Session, slug: str) -> BlogPost:
    post = (
        db.query(BlogPost)
        .filter(BlogPost.slug == slug, BlogPost.statut == BlogPostStatus.PUBLISHED, BlogPost.deleted_at.is_(None))
        .first()
    )
    if not post:
        raise NotFound("Blog post not found")
    return post


def list_all(db: Session) -> list[BlogPost]:
    return db.query(BlogPost).filter(BlogPost.deleted_at.is_(None)).order_by(BlogPost.created_at.desc()).all()


def get_by_id(db: Session, post_id: int) -> BlogPost:
    return _get_by_id(db, post_id)


def create_post(db: Session, current_user: Utilisateur, post_in: BlogPostCreate) -> BlogPost:
    _check_slug_unique(db, post_in.slug)
    post = BlogPost(**post_in.model_dump(), content_html="", author_id=current_user.id)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def update_post(db: Session, post_id: int, post_in: BlogPostUpdate) -> BlogPost:
    post = _get_by_id(db, post_id)
    data = post_in.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"] != post.slug:
        _check_slug_unique(db, data["slug"], exclude_id=post.id)
    if "content_html" in data:
        data["content_html"] = _sanitize(data["content_html"])
    was_published = post.statut == BlogPostStatus.PUBLISHED
    for field, value in data.items():
        setattr(post, field, value)
    if post.statut == BlogPostStatus.PUBLISHED and not was_published and not post.published_at:
        post.published_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return post


def delete_post(db: Session, post_id: int) -> None:
    post = _get_by_id(db, post_id)
    post.deleted_at = datetime.utcnow()
    db.commit()


def _save_image(post_id: int, file_content: bytes, content_type: str) -> str:
    extension = ALLOWED_IMAGE_TYPES.get(content_type)
    if not extension:
        raise BadRequest("Only JPEG, PNG or WEBP images are allowed")
    if len(file_content) > MAX_IMAGE_SIZE:
        raise BadRequest("Image must be smaller than 5 MB")
    post_dir = UPLOAD_ROOT / str(post_id)
    post_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (post_dir / filename).write_bytes(file_content)
    return f"/uploads/blog/{post_id}/{filename}"


def upload_cover_image(db: Session, post_id: int, file_content: bytes, content_type: str) -> BlogPost:
    post = _get_by_id(db, post_id)
    post.cover_image_url = _save_image(post_id, file_content, content_type)
    db.commit()
    db.refresh(post)
    return post


def upload_inline_image(db: Session, post_id: int, file_content: bytes, content_type: str) -> str:
    _get_by_id(db, post_id)
    return _save_image(post_id, file_content, content_type)
