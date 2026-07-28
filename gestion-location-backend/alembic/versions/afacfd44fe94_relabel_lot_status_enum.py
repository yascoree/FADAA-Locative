"""relabel lot status enum

Revision ID: afacfd44fe94
Revises: 4523f8066663
Create Date: 2026-07-28 00:00:00.000000

Lot.statut now uses the DISPONIBLE/LOUE/EN_MAINTENANCE/HORS_SERVICE vocabulary
(same shape the old Bien.statut used, moved down to Lot where occupancy
actually lives) instead of LIBRE/OCCUPE/RESERVE/EN_TRAVAUX. RESERVE was never
auto-set by the app (only LIBRE/OCCUPE toggle automatically) and had no rows,
so it folds into EN_MAINTENANCE rather than being preserved as its own state.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'afacfd44fe94'
down_revision: Union[str, Sequence[str], None] = '4523f8066663'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE TYPE lot_status_new AS ENUM ('DISPONIBLE', 'LOUE', 'EN_MAINTENANCE', 'HORS_SERVICE')")
    op.execute(
        """
        ALTER TABLE lots
        ALTER COLUMN statut TYPE lot_status_new
        USING (
            CASE statut::text
                WHEN 'LIBRE' THEN 'DISPONIBLE'
                WHEN 'OCCUPE' THEN 'LOUE'
                WHEN 'RESERVE' THEN 'EN_MAINTENANCE'
                WHEN 'EN_TRAVAUX' THEN 'EN_MAINTENANCE'
                ELSE NULL
            END
        )::lot_status_new
        """
    )
    op.execute("DROP TYPE lot_status")
    op.execute("ALTER TYPE lot_status_new RENAME TO lot_status")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("CREATE TYPE lot_status_old AS ENUM ('LIBRE', 'OCCUPE', 'RESERVE', 'EN_TRAVAUX')")
    op.execute(
        """
        ALTER TABLE lots
        ALTER COLUMN statut TYPE lot_status_old
        USING (
            CASE statut::text
                WHEN 'DISPONIBLE' THEN 'LIBRE'
                WHEN 'LOUE' THEN 'OCCUPE'
                WHEN 'EN_MAINTENANCE' THEN 'RESERVE'
                WHEN 'HORS_SERVICE' THEN 'EN_TRAVAUX'
                ELSE NULL
            END
        )::lot_status_old
        """
    )
    op.execute("DROP TYPE lot_status")
    op.execute("ALTER TYPE lot_status_old RENAME TO lot_status")
