"""add reserve to lot status enum

Revision ID: abdc930cfe07
Revises: 3f7cbc67a385
Create Date: 2026-07-29 00:00:00.000000

Lot.statut gains RESERVE, set when its bail is EN_ATTENTE (futur/réservé),
alongside the existing DISPONIBLE/LOUE/EN_MAINTENANCE/HORS_SERVICE values.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'abdc930cfe07'
down_revision: Union[str, Sequence[str], None] = '3f7cbc67a385'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE TYPE lot_status_new AS ENUM ('DISPONIBLE', 'LOUE', 'RESERVE', 'EN_MAINTENANCE', 'HORS_SERVICE')")
    op.execute(
        """
        ALTER TABLE lots
        ALTER COLUMN statut TYPE lot_status_new
        USING statut::text::lot_status_new
        """
    )
    op.execute("DROP TYPE lot_status")
    op.execute("ALTER TYPE lot_status_new RENAME TO lot_status")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("CREATE TYPE lot_status_old AS ENUM ('DISPONIBLE', 'LOUE', 'EN_MAINTENANCE', 'HORS_SERVICE')")
    op.execute(
        """
        ALTER TABLE lots
        ALTER COLUMN statut TYPE lot_status_old
        USING (
            CASE statut::text
                WHEN 'RESERVE' THEN 'EN_MAINTENANCE'
                ELSE statut::text
            END
        )::lot_status_old
        """
    )
    op.execute("DROP TYPE lot_status")
    op.execute("ALTER TYPE lot_status_old RENAME TO lot_status")
