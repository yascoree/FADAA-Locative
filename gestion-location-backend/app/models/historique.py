from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship

class Historique(Base):
    __tablename__ = "historiques"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    module = Column(String(255), nullable=False)
    action = Column(String(255), nullable=False)
    # NULL pour les actions qui ne portent pas sur une ressource précise (liste,
    # upload sans identifiant retourné...) — voir HistoriqueMiddleware.
    element_id = Column(Integer, nullable=True)
    # Snapshot de la ressource avant/après une modification (UPDATE uniquement),
    # pour permettre un vrai diff dans l'audit — voir HistoriqueMiddleware.
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    utilisateur = relationship(
        "Utilisateur",
        back_populates="historiques"
    )
