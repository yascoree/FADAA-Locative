"""insert default categories

Revision ID: f1a2b3c4d5e6
Revises: d4e5f6a7b8c9
Create Date: 2026-07-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_CATEGORIES = [
    "Appartement",
    "Villa",
    "Studio",
    "Maison",
    "Duplex",
    "Bureau",
    "Local commercial",
    "Terrain",
]


def upgrade() -> None:
    values = ", ".join(f"('{libelle}', NOW(), NOW())" for libelle in DEFAULT_CATEGORIES)
    op.execute(f"""
        INSERT INTO categories (libelle, created_at, updated_at)
        VALUES {values};
    """)


def downgrade() -> None:
    libelles = ", ".join(f"'{libelle}'" for libelle in DEFAULT_CATEGORIES)
    op.execute(f"""
        DELETE FROM categories
        WHERE libelle IN ({libelles});
    """)
