"""add statut to paiements and quittances

Revision ID: b1c2d3e4f5a6
Revises: a9b8c7d6e5f4
Create Date: 2026-07-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql



# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'a9b8c7d6e5f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


paiement_status_enum = postgresql.ENUM("VALIDE", "ANNULE", name="paiement_status")
quittance_status_enum = postgresql.ENUM("EMISE", "ANNULEE", name="quittance_status")


def upgrade() -> None:
    paiement_status_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "paiements",
        sa.Column("statut", paiement_status_enum, nullable=False, server_default="VALIDE"),
    )

    quittance_status_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "quittances",
        sa.Column("statut", quittance_status_enum, nullable=False, server_default="EMISE"),
    )


def downgrade() -> None:
    op.drop_column("quittances", "statut")
    quittance_status_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_column("paiements", "statut")
    paiement_status_enum.drop(op.get_bind(), checkfirst=True)
