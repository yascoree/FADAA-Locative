import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class BlogPostStatus(int, enum.Enum):
    DRAFT = 1
    PUBLISHED = 2


class BlogPost(Base):
    """Article de blog public (voir app/api/blog_posts.py) — géré depuis
    l'admin, affiché sur /blog et /blog/[slug] côté frontend."""

    __tablename__ = "blog_posts"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    excerpt = Column(Text, nullable=True)
    cover_image_url = Column(String(500), nullable=True)
    content_html = Column(Text, nullable=False, default="")
    keywords = Column(JSON, nullable=True)
    reading_time = Column(String(30), nullable=True)
    statut = Column(Enum(BlogPostStatus, name="blog_post_status"), nullable=False, default=BlogPostStatus.DRAFT)
    published_at = Column(DateTime, nullable=True)
    author_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    author = relationship("Utilisateur", foreign_keys=[author_id])
