"""create charges table

Revision ID: 8442738eeaa9
Revises: 3e84a4e94d0d
Create Date: 2026-08-04 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8442738eeaa9"
down_revision = "3e84a4e94d0d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "charges",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("bien_id", sa.Integer(), sa.ForeignKey("biens.id"), nullable=True),
        sa.Column("lot_id", sa.Integer(), sa.ForeignKey("lots.id"), nullable=True),
        sa.Column("libelle", sa.String(length=150), nullable=False),
        sa.Column("montant", sa.DECIMAL(precision=10, scale=2), nullable=False),
        sa.Column("date_charge", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cree_par_id", sa.Integer(), sa.ForeignKey("utilisateurs.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_charges_bien_id", "charges", ["bien_id"])
    op.create_index("ix_charges_lot_id", "charges", ["lot_id"])


def downgrade() -> None:
    op.drop_index("ix_charges_lot_id", table_name="charges")
    op.drop_index("ix_charges_bien_id", table_name="charges")
    op.drop_table("charges")
