from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Discussion(Base):
    __tablename__ = "discussions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    message = Column(Text, nullable=False)
    date_sent = Column(DateTime, nullable=False, default=datetime.utcnow)
    pdf = Column(String(255), nullable=True)

    # Relationships
    user = relationship("Utilisateur", back_populates="discussions")
