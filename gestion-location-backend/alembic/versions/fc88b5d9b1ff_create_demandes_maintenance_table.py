"""create demandes_maintenance table

Revision ID: fc88b5d9b1ff
Revises: 8442738eeaa9
Create Date: 2026-08-04 00:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "fc88b5d9b1ff"
down_revision = "8442738eeaa9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    demande_maintenance_status = sa.Enum(
        "NOUVELLE", "EN_COURS", "RESOLUE", "REJETEE", name="demande_maintenance_status"
    )

    op.create_table(
        "demandes_maintenance",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("bail_id", sa.Integer(), sa.ForeignKey("baux.id"), nullable=False),
        sa.Column("locataire_id", sa.Integer(), sa.ForeignKey("utilisateurs.id"), nullable=False),
        sa.Column("titre", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("statut", demande_maintenance_status, nullable=False, server_default="NOUVELLE"),
        sa.Column("reponse", sa.Text(), nullable=True),
        sa.Column("traite_par_id", sa.Integer(), sa.ForeignKey("utilisateurs.id"), nullable=True),
        sa.Column("date_creation", sa.DateTime(), nullable=False),
        sa.Column("date_traitement", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_demandes_maintenance_bail_id", "demandes_maintenance", ["bail_id"])
    op.create_index("ix_demandes_maintenance_locataire_id", "demandes_maintenance", ["locataire_id"])


def downgrade() -> None:
    op.drop_index("ix_demandes_maintenance_locataire_id", table_name="demandes_maintenance")
    op.drop_index("ix_demandes_maintenance_bail_id", table_name="demandes_maintenance")
    op.drop_table("demandes_maintenance")
    sa.Enum(name="demande_maintenance_status").drop(op.get_bind(), checkfirst=True)
