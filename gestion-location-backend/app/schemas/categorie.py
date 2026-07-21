from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CategorieBase(BaseModel):
    libelle: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None


class CategorieCreate(CategorieBase):
    pass


class CategorieUpdate(BaseModel):
    libelle: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None


class CategorieRead(CategorieBase):
    model_config = ConfigDict(from_attributes=True)

    id: int