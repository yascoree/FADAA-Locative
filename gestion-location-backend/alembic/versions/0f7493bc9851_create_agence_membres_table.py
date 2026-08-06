"""create agence_membres table

Revision ID: 0f7493bc9851
Revises: 04d196c2e270
Create Date: 2026-08-05 10:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0f7493bc9851"
down_revision = "04d196c2e270"
branch_labels = None
depends_on = None


def upgrade() -> None:
    role_agence = sa.Enum("ADMIN", "MEMBRE", name="role_agence")
    agence_membre_status = sa.Enum("ACTIF", "REVOQUE", name="agence_membre_status")

    op.create_table(
        "agence_membres",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("agence_id", sa.Integer(), sa.ForeignKey("agences.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "utilisateur_id",
            sa.Integer(),
            sa.ForeignKey("utilisateurs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role_agence", role_agence, nullable=False),
        sa.Column("statut", agence_membre_status, nullable=False, server_default="ACTIF"),
        sa.Column("date_debut", sa.Date(), nullable=True),
        sa.Column("date_fin", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_agence_membres_agence_id", "agence_membres", ["agence_id"])
    op.create_index("ix_agence_membres_utilisateur_id", "agence_membres", ["utilisateur_id"])
    # Au plus une ligne ACTIF par utilisateur (V1 : pas de multi-appartenance
    # simultanée — voir app.models.agence_membre pour le raisonnement).
    op.create_index(
        "uq_agence_membres_active_utilisateur",
        "agence_membres",
        ["utilisateur_id"],
        unique=True,
        postgresql_where=sa.text("statut = 'ACTIF'"),
    )


def downgrade() -> None:
    op.drop_index("uq_agence_membres_active_utilisateur", table_name="agence_membres")
    op.drop_index("ix_agence_membres_utilisateur_id", table_name="agence_membres")
    op.drop_index("ix_agence_membres_agence_id", table_name="agence_membres")
    op.drop_table("agence_membres")
    sa.Enum(name="agence_membre_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="role_agence").drop(op.get_bind(), checkfirst=True)
