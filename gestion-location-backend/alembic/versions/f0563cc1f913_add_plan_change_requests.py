"""add plan change requests

Revision ID: f0563cc1f913
Revises: 6f0f80869c00
Create Date: 2026-08-01 21:33:33.552910

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0563cc1f913'
down_revision: Union[str, Sequence[str], None] = '6f0f80869c00'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'PLAN_CHANGE_REQUEST'")

    op.create_table(
        'plan_change_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('plan_id', sa.Integer(), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column(
            'statut',
            sa.Enum('EN_ATTENTE', 'APPROUVEE', 'REJETEE', name='plan_change_request_status'),
            nullable=False,
        ),
        sa.Column('date_creation', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['utilisateurs.id']),
        sa.ForeignKeyConstraint(['plan_id'], ['subscription_plans.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_plan_change_requests_id'), 'plan_change_requests', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_plan_change_requests_id'), table_name='plan_change_requests')
    op.drop_table('plan_change_requests')
    # PostgreSQL ne permet pas de retirer une valeur d'un enum sans recréer le
    # type et migrer toutes les colonnes qui l'utilisent — hors scope ici.
