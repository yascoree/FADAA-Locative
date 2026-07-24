"""add frequence_paiement to baux

Revision ID: a9b8c7d6e5f4
Revises: f1a2b3c4d5e6
Create Date: 2026-07-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql



# revision identifiers, used by Alembic.
revision: str = 'a9b8c7d6e5f4'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


frequence_paiement_enum = postgresql.ENUM(
    "JOUR", "SEMAINE", "MOIS", "ANNEE", name="frequence_paiement"
)


def upgrade() -> None:
    frequence_paiement_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "baux",
        sa.Column(
            "frequence_paiement",
            frequence_paiement_enum,
            nullable=False,
            server_default="MOIS",
        ),
    )


def downgrade() -> None:
    op.drop_column("baux", "frequence_paiement")
    frequence_paiement_enum.drop(op.get_bind(), checkfirst=True)
