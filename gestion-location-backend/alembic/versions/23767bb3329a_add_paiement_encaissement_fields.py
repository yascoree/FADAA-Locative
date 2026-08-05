"""add paiement encaissement fields

Revision ID: 23767bb3329a
Revises: 0e73c36ddf3b
Create Date: 2026-08-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "23767bb3329a"
down_revision = "0e73c36ddf3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "paiements",
        sa.Column("encaisse", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column("paiements", sa.Column("date_encaissement", sa.DateTime(), nullable=True))
    op.add_column("paiements", sa.Column("agence_bancaire", sa.String(length=255), nullable=True))
    op.add_column("paiements", sa.Column("reference_paiement", sa.String(length=255), nullable=True))
    op.add_column("paiements", sa.Column("justificatif", sa.String(length=500), nullable=True))
    op.add_column("paiements", sa.Column("justificatif_nom", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("paiements", "justificatif_nom")
    op.drop_column("paiements", "justificatif")
    op.drop_column("paiements", "reference_paiement")
    op.drop_column("paiements", "agence_bancaire")
    op.drop_column("paiements", "date_encaissement")
    op.drop_column("paiements", "encaisse")
