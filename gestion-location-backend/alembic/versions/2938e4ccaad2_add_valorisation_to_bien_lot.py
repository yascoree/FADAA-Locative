"""add valorisation to bien and lot

Revision ID: 2938e4ccaad2
Revises: 23767bb3329a
Create Date: 2026-08-04 00:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2938e4ccaad2"
down_revision = "23767bb3329a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("biens", sa.Column("valorisation", sa.DECIMAL(precision=12, scale=2), nullable=True))
    op.add_column("lots", sa.Column("valorisation", sa.DECIMAL(precision=12, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column("lots", "valorisation")
    op.drop_column("biens", "valorisation")
