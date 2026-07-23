"""add GESTION value to notification_type enum

Revision ID: a1b2c3d4e5f6
Revises: 23150b7cb4bc
Create Date: 2026-07-23 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '23150b7cb4bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'GESTION'")


def downgrade() -> None:
    # Postgres does not support removing a value from an enum type.
    pass
