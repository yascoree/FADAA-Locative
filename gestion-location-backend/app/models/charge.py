from datetime import datetime

from sqlalchemy import DECIMAL, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Charge(Base):
    """Dépense ponctuelle liée à un bien ou à un lot (jamais les deux à la fois —
    voir charge_service._resolve_bien), déduite du total des revenus correspondants
    (voir stats_service.get_revenue_stats)."""

    __tablename__ = "charges"

    id = Column(Integer, primary_key=True, index=True)
    bien_id = Column(Integer, ForeignKey("biens.id"), nullable=True)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=True)
    libelle = Column(String(150), nullable=False)
    montant = Column(DECIMAL(10, 2), nullable=False)
    date_charge = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    cree_par_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    bien = relationship("Bien")
    lot = relationship("Lot")
    createur = relationship("Utilisateur", foreign_keys=[cree_par_id])
