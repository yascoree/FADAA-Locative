from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class ManagerPermission(Base):
    """Une permission accordée par un propriétaire à un gestionnaire, dans le
    cadre d'un Mandat précis. Le propriétaire (ou un admin) contrôle ces lignes ;
    le gestionnaire n'y a jamais d'accès en écriture."""

    __tablename__ = "manager_permissions"
    __table_args__ = (UniqueConstraint("mandat_id", "permission_id", name="uq_manager_permission"),)

    id = Column(Integer, primary_key=True, index=True)
    mandat_id = Column(Integer, ForeignKey("mandats.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)
    date_attribution = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    mandat = relationship("Mandat", back_populates="permissions")
    permission = relationship("Permission", back_populates="manager_permissions")
