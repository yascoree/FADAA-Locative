"""add old_values/new_values JSON columns to historiques (audit diff for updates)

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-07-27 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('historiques', sa.Column('old_values', sa.JSON(), nullable=True))
    op.add_column('historiques', sa.Column('new_values', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('historiques', 'new_values')
    op.drop_column('historiques', 'old_values')
