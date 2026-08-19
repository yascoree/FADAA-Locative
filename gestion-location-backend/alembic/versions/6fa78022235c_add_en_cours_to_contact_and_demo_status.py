"""add EN_COURS to contact_message_status and demande_demo_status

Revision ID: 6fa78022235c
Revises: 60e32f97c624
Create Date: 2026-08-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '6fa78022235c'
down_revision: Union[str, Sequence[str], None] = '60e32f97c624'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE contact_message_status ADD VALUE IF NOT EXISTS 'EN_COURS'")
    op.execute("ALTER TYPE demande_demo_status ADD VALUE IF NOT EXISTS 'EN_COURS'")


def downgrade() -> None:
    # Postgres does not support removing a value from an enum type.
    pass
