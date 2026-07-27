"""make historiques.element_id nullable (list/global actions have no single id)

Revision ID: c4d5e6f7a8b9
Revises: b1c2d3e4f5a6
Create Date: 2026-07-27 09:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('historiques', 'element_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column('historiques', 'element_id', existing_type=sa.Integer(), nullable=False)
