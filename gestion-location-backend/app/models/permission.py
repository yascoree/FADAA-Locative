from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    libelle = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)

    # Relationships
    manager_permissions = relationship(
        "ManagerPermission", back_populates="permission", cascade="all, delete-orphan"
    )
