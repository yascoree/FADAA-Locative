"""add invitation_client notification type

Revision ID: 0785256f8806
Revises: 06628d43f6f7
Create Date: 2026-08-06 16:05:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "0785256f8806"
down_revision = "06628d43f6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'INVITATION_CLIENT'")


def downgrade() -> None:
    # Postgres can't drop a single enum value — no-op, matches the existing
    # convention for prior additive enum-value migrations in this project.
    pass
