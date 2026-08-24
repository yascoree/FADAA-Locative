"""Merge heads

Revision ID: c1ffb754e5ce
Revises: 6fa78022235c, 80c46c1020e2
Create Date: 2026-08-24 12:29:55.040946

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1ffb754e5ce'
down_revision: Union[str, Sequence[str], None] = ('6fa78022235c', '80c46c1020e2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
