"""merge reserve lot status and ayoub heads

Revision ID: 45de71ec66b5
Revises: abdc930cfe07, 6f0f80869c00
Create Date: 2026-07-29 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '45de71ec66b5'
down_revision: Union[str, Sequence[str], None] = ('abdc930cfe07', '6f0f80869c00')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
