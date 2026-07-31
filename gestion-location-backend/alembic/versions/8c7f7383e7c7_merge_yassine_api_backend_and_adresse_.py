"""merge yassine api_backend and adresse/location heads

Revision ID: 8c7f7383e7c7
Revises: 3f7cbc67a385, f40a824a42ca
Create Date: 2026-07-29 16:07:55.698344

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c7f7383e7c7'
down_revision: Union[str, Sequence[str], None] = ('3f7cbc67a385', 'f40a824a42ca')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
