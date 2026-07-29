"""add adresse to biens

Revision ID: b22b225d3c1c
Revises: 229475589f33
Create Date: 2026-07-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b22b225d3c1c'
down_revision: Union[str, Sequence[str], None] = '229475589f33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('biens', sa.Column('adresse', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('biens', 'adresse')
