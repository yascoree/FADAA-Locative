"""create invitations_client table

Revision ID: 06628d43f6f7
Revises: 0b794f4f6433
Create Date: 2026-08-06 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "06628d43f6f7"
down_revision = "0b794f4f6433"
branch_labels = None
depends_on = None


def upgrade() -> None:
    invitation_client_status = sa.Enum(
        "EN_ATTENTE", "ACCEPTEE", "REFUSEE", "EXPIREE", name="invitation_client_status"
    )

    op.create_table(
        "invitations_client",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("agence_id", sa.Integer(), sa.ForeignKey("agences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("proprietaire_id", sa.Integer(), sa.ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("statut", invitation_client_status, nullable=False, server_default="EN_ATTENTE"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("responded_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_invitations_client_agence_id", "invitations_client", ["agence_id"])
    op.create_index("ix_invitations_client_proprietaire_id", "invitations_client", ["proprietaire_id"])
    # Empêche une agence de spammer le même propriétaire de plusieurs invitations
    # simultanées tant que la précédente n'a pas été traitée.
    op.create_index(
        "uq_invitations_client_pending",
        "invitations_client",
        ["agence_id", "proprietaire_id"],
        unique=True,
        postgresql_where=sa.text("statut = 'EN_ATTENTE'"),
    )


def downgrade() -> None:
    op.drop_index("uq_invitations_client_pending", table_name="invitations_client")
    op.drop_index("ix_invitations_client_proprietaire_id", table_name="invitations_client")
    op.drop_index("ix_invitations_client_agence_id", table_name="invitations_client")
    op.drop_table("invitations_client")
    sa.Enum(name="invitation_client_status").drop(op.get_bind(), checkfirst=True)
