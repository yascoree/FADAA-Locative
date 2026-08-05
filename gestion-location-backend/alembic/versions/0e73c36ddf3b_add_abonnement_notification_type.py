"""add abonnement notification type

Revision ID: 0e73c36ddf3b
Revises: eda84ed524bc
Create Date: 2026-08-04 12:34:42.172660

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0e73c36ddf3b'
down_revision: Union[str, Sequence[str], None] = 'eda84ed524bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ABONNEMENT'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres can't drop a single enum value — no-op, matches the existing
    # convention for prior additive enum-value migrations in this project.
    pass
