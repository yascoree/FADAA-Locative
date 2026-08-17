"""add charges fields to echeance

Revision ID: 3e84a4e94d0d
Revises: 2938e4ccaad2
Create Date: 2026-08-04 00:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3e84a4e94d0d"
down_revision = "2938e4ccaad2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("echeances", sa.Column("charges", sa.DECIMAL(precision=10, scale=2), nullable=True))
    op.add_column(
        "echeances",
        sa.Column("charges_incluses", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("echeances", "charges_incluses")
    op.drop_column("echeances", "charges")
