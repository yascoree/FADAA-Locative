"""merge lot status and plan change requests heads

Revision ID: 1b61cd60da62
Revises: 45de71ec66b5, f0563cc1f913
Create Date: 2026-08-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1b61cd60da62'
down_revision: Union[str, Sequence[str], None] = ('45de71ec66b5', 'f0563cc1f913')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
