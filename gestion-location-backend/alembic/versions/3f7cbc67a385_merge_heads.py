"""merge heads

Revision ID: 3f7cbc67a385
Revises: 5db2b8b92c09, e3f4a5b6c7d8
Create Date: 2026-07-29 14:33:18.535159

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f7cbc67a385'
down_revision: Union[str, Sequence[str], None] = ('5db2b8b92c09', 'e3f4a5b6c7d8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
