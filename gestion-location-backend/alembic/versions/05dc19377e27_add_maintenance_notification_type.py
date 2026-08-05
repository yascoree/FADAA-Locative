"""add maintenance notification type

Revision ID: 05dc19377e27
Revises: fc88b5d9b1ff
Create Date: 2026-08-04 00:41:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "05dc19377e27"
down_revision = "fc88b5d9b1ff"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'MAINTENANCE'")


def downgrade() -> None:
    # Postgres can't drop a single enum value — no-op, matches the existing
    # convention for prior additive enum-value migrations in this project.
    pass
