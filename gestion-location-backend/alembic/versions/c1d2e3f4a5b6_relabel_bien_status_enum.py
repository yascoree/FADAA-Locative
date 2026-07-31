"""relabel bien status enum

Revision ID: c1d2e3f4a5b6
Revises: afacfd44fe94
Create Date: 2026-07-29 00:00:00.000000

Bien.statut now uses ACTIF/INACTIF/ARCHIVE (spec 9.1) instead of
ACTIF/EN_TRAVAUX/HORS_SERVICE. EN_TRAVAUX folds into INACTIF (temporarily
unavailable) and HORS_SERVICE folds into ARCHIVE (retired) — the closest
semantic match for existing rows.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'afacfd44fe94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE TYPE bien_status_new AS ENUM ('ACTIF', 'INACTIF', 'ARCHIVE')")
    op.execute(
        """
        ALTER TABLE biens
        ALTER COLUMN statut TYPE bien_status_new
        USING (
            CASE statut::text
                WHEN 'ACTIF' THEN 'ACTIF'
                WHEN 'EN_TRAVAUX' THEN 'INACTIF'
                WHEN 'HORS_SERVICE' THEN 'ARCHIVE'
                ELSE NULL
            END
        )::bien_status_new
        """
    )
    op.execute("DROP TYPE bien_status")
    op.execute("ALTER TYPE bien_status_new RENAME TO bien_status")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("CREATE TYPE bien_status_old AS ENUM ('ACTIF', 'EN_TRAVAUX', 'HORS_SERVICE')")
    op.execute(
        """
        ALTER TABLE biens
        ALTER COLUMN statut TYPE bien_status_old
        USING (
            CASE statut::text
                WHEN 'ACTIF' THEN 'ACTIF'
                WHEN 'INACTIF' THEN 'EN_TRAVAUX'
                WHEN 'ARCHIVE' THEN 'HORS_SERVICE'
                ELSE NULL
            END
        )::bien_status_old
        """
    )
    op.execute("DROP TYPE bien_status")
    op.execute("ALTER TYPE bien_status_old RENAME TO bien_status")
