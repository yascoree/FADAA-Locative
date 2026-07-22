from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class BienPhoto(Base):
    __tablename__ = "bien_photos"

    id = Column(Integer, primary_key=True, index=True)
    bien_id = Column(Integer, ForeignKey("biens.id"), nullable=False)
    url = Column(String(255), nullable=False)
    date_ajout = Column(DateTime, nullable=False, default=datetime.utcnow)

    bien = relationship("Bien", back_populates="photos")
