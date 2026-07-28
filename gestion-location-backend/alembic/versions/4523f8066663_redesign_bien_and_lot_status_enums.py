"""redesign bien and lot status enums

Revision ID: 4523f8066663
Revises: d4490c1de3f8
Create Date: 2026-07-28 00:00:00.000000

Bien no longer tracks occupancy (DISPONIBLE/LOUE) — that's the Lot's job, since
a bien can have several lots in different occupancy states. Bien.statut now
reflects the property itself: ACTIF / EN_TRAVAUX / HORS_SERVICE.
Lot gains EN_TRAVAUX for a unit made temporarily unavailable outside of the
existing LIBRE/OCCUPE/RESERVE occupancy states.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4523f8066663'
down_revision: Union[str, Sequence[str], None] = 'd4490c1de3f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # lot_status: purely additive, safe to just add the new value.
    op.execute("ALTER TYPE lot_status ADD VALUE IF NOT EXISTS 'EN_TRAVAUX'")

    # bien_status: DISPONIBLE/LOUE collapse into ACTIF, MAINTENANCE becomes
    # EN_TRAVAUX, HORS_SERVICE is unchanged — Postgres enums can't drop/rename
    # values away in one step, so swap in a fresh type with a data mapping.
    op.execute("CREATE TYPE bien_status_new AS ENUM ('ACTIF', 'EN_TRAVAUX', 'HORS_SERVICE')")
    op.execute(
        """
        ALTER TABLE biens
        ALTER COLUMN statut TYPE bien_status_new
        USING (
            CASE statut::text
                WHEN 'DISPONIBLE' THEN 'ACTIF'
                WHEN 'LOUE' THEN 'ACTIF'
                WHEN 'MAINTENANCE' THEN 'EN_TRAVAUX'
                WHEN 'HORS_SERVICE' THEN 'HORS_SERVICE'
                ELSE NULL
            END
        )::bien_status_new
        """
    )
    op.execute("DROP TYPE bien_status")
    op.execute("ALTER TYPE bien_status_new RENAME TO bien_status")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("CREATE TYPE bien_status_old AS ENUM ('DISPONIBLE', 'LOUE', 'MAINTENANCE', 'HORS_SERVICE')")
    op.execute(
        """
        ALTER TABLE biens
        ALTER COLUMN statut TYPE bien_status_old
        USING (
            CASE statut::text
                WHEN 'ACTIF' THEN 'DISPONIBLE'
                WHEN 'EN_TRAVAUX' THEN 'MAINTENANCE'
                WHEN 'HORS_SERVICE' THEN 'HORS_SERVICE'
                ELSE NULL
            END
        )::bien_status_old
        """
    )
    op.execute("DROP TYPE bien_status")
    op.execute("ALTER TYPE bien_status_old RENAME TO bien_status")

    # lot_status: Postgres can't drop an enum value — EN_TRAVAUX stays defined
    # but unused, any rows already using it are left as-is.
