"""add bien_id to mandats (per-property mandate scope)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-23 16:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NULL = mandate covers all of the proprietaire's biens (existing behavior,
    # preserved for every mandate created before this migration). Non-NULL scopes
    # the mandate to that single bien, letting a proprietaire assign the same
    # gestionnaire to several biens independently, each with its own permissions.
    op.add_column('mandats', sa.Column('bien_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_mandats_bien_id', 'mandats', 'biens', ['bien_id'], ['id'], ondelete='CASCADE'
    )


def downgrade() -> None:
    op.drop_constraint('fk_mandats_bien_id', 'mandats', type_='foreignkey')
    op.drop_column('mandats', 'bien_id')
