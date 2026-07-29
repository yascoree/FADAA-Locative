"""add cancellation fields to paiements

Revision ID: d4490c1de3f8
Revises: d25168ed298b
Create Date: 2026-07-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4490c1de3f8'
down_revision: Union[str, Sequence[str], None] = 'd25168ed298b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('paiements', sa.Column('annule_par', sa.Integer(), nullable=True))
    op.add_column('paiements', sa.Column('date_annulation', sa.DateTime(), nullable=True))
    op.add_column('paiements', sa.Column('motif_annulation', sa.String(length=255), nullable=True))
    op.create_foreign_key(
        'paiements_annule_par_fkey', 'paiements', 'utilisateurs', ['annule_par'], ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('paiements_annule_par_fkey', 'paiements', type_='foreignkey')
    op.drop_column('paiements', 'motif_annulation')
    op.drop_column('paiements', 'date_annulation')
    op.drop_column('paiements', 'annule_par')
