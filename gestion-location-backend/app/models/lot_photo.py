from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class LotPhoto(Base):
    __tablename__ = "lot_photos"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=False)
    url = Column(String(255), nullable=False)
    date_ajout = Column(DateTime, nullable=False, default=datetime.utcnow)

    lot = relationship("Lot", back_populates="photos")
