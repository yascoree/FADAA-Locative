"""create agences table

Revision ID: 04d196c2e270
Revises: 05dc19377e27
Create Date: 2026-08-05 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "04d196c2e270"
down_revision = "05dc19377e27"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agences",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("nom", sa.String(length=150), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("agences")
