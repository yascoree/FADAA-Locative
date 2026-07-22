from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship

class Historique(Base):
    __tablename__ = "historiques"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    module = Column(String(255), nullable=False)
    action = Column(String(255), nullable=False)
    element_id = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



    utilisateur = relationship(
    "Utilisateur",
    back_populates="historiques"
    )