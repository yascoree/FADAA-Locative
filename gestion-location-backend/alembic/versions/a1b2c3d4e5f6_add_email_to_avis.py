"""add email to avis

Revision ID: a1b2c3d4e5f6
Revises: eff12d67df74
Create Date: 2026-08-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'eff12d67df74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('avis', sa.Column('email', sa.String(length=255), nullable=True))
    # Backfill from the linked account when available, so existing reviews from
    # registered users don't lose their email in the admin listing.
    op.execute(
        """
        UPDATE avis
        SET email = utilisateurs.email
        FROM utilisateurs
        WHERE avis.user_id = utilisateurs.id AND avis.email IS NULL
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('avis', 'email')
