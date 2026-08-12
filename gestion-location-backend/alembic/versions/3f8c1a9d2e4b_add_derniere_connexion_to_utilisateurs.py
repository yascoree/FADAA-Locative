"""add derniere_connexion to utilisateurs

Revision ID: 3f8c1a9d2e4b
Revises: 0785256f8806
Create Date: 2026-08-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "3f8c1a9d2e4b"
down_revision = "0785256f8806"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("utilisateurs", sa.Column("derniere_connexion", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("utilisateurs", "derniere_connexion")
