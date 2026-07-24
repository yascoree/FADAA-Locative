"""add generic attachments to discussions (files/photos, not just pdf)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-24 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The old `pdf` column was never wired up (0 rows use it) — repurposed into a
    # generic attachment so a discussion message can carry any file (photo, doc...),
    # not just a PDF. `piece_jointe_nom` keeps the original filename for display,
    # since the stored path uses a random UUID.
    op.alter_column('discussions', 'pdf', new_column_name='piece_jointe')
    op.add_column('discussions', sa.Column('piece_jointe_nom', sa.String(255), nullable=True))
    op.add_column('discussions', sa.Column('piece_jointe_type', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('discussions', 'piece_jointe_type')
    op.drop_column('discussions', 'piece_jointe_nom')
    op.alter_column('discussions', 'piece_jointe', new_column_name='pdf')
