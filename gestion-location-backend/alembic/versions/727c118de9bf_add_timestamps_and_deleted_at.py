"""add timestamps and deleted_at

Revision ID: 727c118de9bf
Revises: a5ecf50f6eb2
Create Date: 2026-07-22 11:34:11.500498

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '727c118de9bf'
down_revision: Union[str, Sequence[str], None] = 'a5ecf50f6eb2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES_FULL = [
    'baux', 'biens', 'categories', 'discussions', 'echeances',
    'lots', 'notifications', 'paiements', 'partenaires',
    'profils', 'quittances', 'utilisateurs',
]

# mandats already has updated_at from migration 4e5d53521450
TABLES_CREATED_DELETED_ONLY = ['mandats']

TABLES_CREATED_UPDATED_ONLY = ['avis']
TABLES_UPDATED_DELETED_ONLY = ['plan_permissions']
TABLES_DELETED_ONLY = ['subscription_plans', 'subscriptions']


def upgrade() -> None:
    """Upgrade schema."""

    for table in TABLES_CREATED_UPDATED_ONLY:
        op.add_column(table, sa.Column('created_at', sa.DateTime(), nullable=False,
                                        server_default=sa.func.now()))
        op.add_column(table, sa.Column('updated_at', sa.DateTime(), nullable=False,
                                        server_default=sa.func.now()))

    for table in TABLES_FULL:
        op.add_column(table, sa.Column('created_at', sa.DateTime(), nullable=False,
                                        server_default=sa.func.now()))
        op.add_column(table, sa.Column('updated_at', sa.DateTime(), nullable=False,
                                        server_default=sa.func.now()))
        op.add_column(table, sa.Column('deleted_at', sa.DateTime(), nullable=True))

    for table in TABLES_CREATED_DELETED_ONLY:
        op.add_column(table, sa.Column('created_at', sa.DateTime(), nullable=False,
                                        server_default=sa.func.now()))
        op.add_column(table, sa.Column('deleted_at', sa.DateTime(), nullable=True))

    for table in TABLES_UPDATED_DELETED_ONLY:
        op.add_column(table, sa.Column('updated_at', sa.DateTime(), nullable=False,
                                        server_default=sa.func.now()))
        op.add_column(table, sa.Column('deleted_at', sa.DateTime(), nullable=True))

    for table in TABLES_DELETED_ONLY:
        op.add_column(table, sa.Column('deleted_at', sa.DateTime(), nullable=True))

    for table in TABLES_CREATED_UPDATED_ONLY + TABLES_FULL + TABLES_CREATED_DELETED_ONLY:
        op.alter_column(table, 'created_at', server_default=None)
    for table in TABLES_CREATED_UPDATED_ONLY + TABLES_FULL:
        op.alter_column(table, 'updated_at', server_default=None)
    for table in TABLES_UPDATED_DELETED_ONLY:
        op.alter_column(table, 'updated_at', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    for table in TABLES_DELETED_ONLY:
        op.drop_column(table, 'deleted_at')

    for table in TABLES_UPDATED_DELETED_ONLY:
        op.drop_column(table, 'deleted_at')
        op.drop_column(table, 'updated_at')

    for table in TABLES_CREATED_DELETED_ONLY:
        op.drop_column(table, 'deleted_at')
        op.drop_column(table, 'created_at')

    for table in reversed(TABLES_FULL):
        op.drop_column(table, 'deleted_at')
        op.drop_column(table, 'updated_at')
        op.drop_column(table, 'created_at')

    for table in TABLES_CREATED_UPDATED_ONLY:
        op.drop_column(table, 'updated_at')
        op.drop_column(table, 'created_at')