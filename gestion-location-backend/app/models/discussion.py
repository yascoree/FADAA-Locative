from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Discussion(Base):
    __tablename__ = "discussions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    # Nullable en base pour ne pas casser les lignes créées avant l'ajout de ce
    # champ ; toujours requis côté API (voir DiscussionCreate) pour tout nouveau message.
    destinataire_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    message = Column(Text, nullable=False)
    date_sent = Column(DateTime, nullable=False, default=datetime.utcnow)
    pdf = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("Utilisateur", back_populates="discussions", foreign_keys=[user_id])
    destinataire = relationship("Utilisateur", foreign_keys=[destinataire_id])
