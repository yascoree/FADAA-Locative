"""add latitude longitude to biens

Revision ID: f40a824a42ca
Revises: b22b225d3c1c
Create Date: 2026-07-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f40a824a42ca'
down_revision: Union[str, Sequence[str], None] = 'b22b225d3c1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('biens', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('biens', sa.Column('longitude', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('biens', 'longitude')
    op.drop_column('biens', 'latitude')
