"""add color to subscription_plans

Revision ID: 6f0f80869c00
Revises: 8c7f7383e7c7
Create Date: 2026-07-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f0f80869c00'
down_revision: Union[str, Sequence[str], None] = '8c7f7383e7c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Même cycle que l'ancien assignement automatique côté front (planTone()) : les
# plans d'essai passaient en terracotta, les autres tournaient sur olive/navy/
# charcoal par prix croissant. On le rejoue ici pour que les plans existants
# gardent la même couleur de carte après la migration.
NON_TRIAL_CYCLE = ("olive", "navy", "charcoal")


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "subscription_plans",
        sa.Column("color", sa.String(20), nullable=False, server_default="olive"),
    )
    op.alter_column("subscription_plans", "color", server_default=None)

    conn = op.get_bind()
    plans = conn.execute(
        sa.text("SELECT id, is_trial, price FROM subscription_plans WHERE deleted_at IS NULL ORDER BY is_trial DESC, price ASC")
    ).fetchall()
    non_trial_index = 0
    for plan in plans:
        if plan.is_trial:
            color = "terracotta"
        else:
            color = NON_TRIAL_CYCLE[non_trial_index % len(NON_TRIAL_CYCLE)]
            non_trial_index += 1
        conn.execute(
            sa.text("UPDATE subscription_plans SET color = :color WHERE id = :id"),
            {"color": color, "id": plan.id},
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("subscription_plans", "color")
