"""add avis reclamation demande_demo notification types

Revision ID: afbcd0d8d1a4
Revises: 1403ac27f7ce
Create Date: 2026-07-27 17:37:09.683488

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'afbcd0d8d1a4'
down_revision: Union[str, Sequence[str], None] = '1403ac27f7ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'AVIS'")
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'RECLAMATION'")
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'DEMANDE_DEMO'")


def downgrade() -> None:
    """Downgrade schema."""
    # PostgreSQL ne permet pas de retirer une valeur d'un enum sans recréer le
    # type et migrer toutes les colonnes qui l'utilisent — hors scope ici.
    pass
