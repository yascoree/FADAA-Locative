from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.blog_post import BlogPostStatus


class BlogPostCreate(BaseModel):
    slug: str = Field(max_length=255)
    title: str = Field(max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)
    excerpt: Optional[str] = None
    keywords: Optional[list[str]] = None
    reading_time: Optional[str] = Field(default=None, max_length=30)


class BlogPostUpdate(BaseModel):
    slug: Optional[str] = Field(default=None, max_length=255)
    title: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)
    excerpt: Optional[str] = None
    content_html: Optional[str] = None
    keywords: Optional[list[str]] = None
    reading_time: Optional[str] = Field(default=None, max_length=30)
    statut: Optional[BlogPostStatus] = None


class BlogPostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    description: Optional[str] = None
    excerpt: Optional[str] = None
    cover_image_url: Optional[str] = None
    content_html: str
    keywords: Optional[list[str]] = None
    reading_time: Optional[str] = None
    statut: BlogPostStatus
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
