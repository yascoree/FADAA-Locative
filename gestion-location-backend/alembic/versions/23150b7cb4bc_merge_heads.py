"""merge heads

Revision ID: 23150b7cb4bc
Revises: 727c118de9bf, 95dcb3f0e596
Create Date: 2026-07-22 19:07:13.337728

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '23150b7cb4bc'
down_revision: Union[str, Sequence[str], None] = ('727c118de9bf', '95dcb3f0e596')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
