"""seed PRO and ENTERPRISE subscription plans

Revision ID: 5db2b8b92c09
Revises: c1d2e3f4a5b6
Create Date: 2026-07-29 00:00:00.000000

"""
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert


# revision identifiers, used by Alembic.
revision: str = '5db2b8b92c09'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Les plans PRO et ENTERPRISE avaient été créés à la main depuis l'interface
    # admin (Abonnements) plutôt que par migration, donc absents d'une base neuve
    # après `alembic upgrade head`. On les rejoue ici à l'identique des valeurs
    # actuellement en prod/dev (ON CONFLICT DO NOTHING = idempotent si un plan du
    # même nom existe déjà, ex: rejoué sur la base où ils ont été créés à la main).
    subscription_plans_table = sa.table(
        "subscription_plans",
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("price", sa.DECIMAL),
        sa.column("duration_days", sa.Integer),
        sa.column("is_trial", sa.Boolean),
        sa.column("is_active", sa.Boolean),
        sa.column("max_biens", sa.Integer),
        sa.column("max_lots", sa.Integer),
        sa.column("max_baux_actifs", sa.Integer),
        sa.column("max_gestionnaires", sa.Integer),
        sa.column("max_locataires", sa.Integer),
        sa.column("max_quittances_mois", sa.Integer),
        sa.column("created_at", sa.DateTime),
        sa.column("updated_at", sa.DateTime),
    )

    now = datetime.utcnow()
    stmt = pg_insert(subscription_plans_table).values(
        [
            {
                "name": "PRO",
                "description": "Pour les propriétaires avec un portefeuille en croissance.",
                "price": 299,
                "duration_days": 30,
                "is_trial": False,
                "is_active": True,
                "max_biens": 20,
                "max_lots": 100,
                "max_baux_actifs": 100,
                "max_gestionnaires": 5,
                "max_locataires": 100,
                "max_quittances_mois": 300,
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "ENTERPRISE",
                "description": "Pour les grandes structures : usage illimité.",
                "price": 999,
                "duration_days": 30,
                "is_trial": False,
                "is_active": True,
                "max_biens": -1,
                "max_lots": -1,
                "max_baux_actifs": -1,
                "max_gestionnaires": -1,
                "max_locataires": -1,
                "max_quittances_mois": -1,
                "created_at": now,
                "updated_at": now,
            },
        ]
    ).on_conflict_do_nothing(index_elements=["name"])
    op.execute(stmt)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM subscription_plans WHERE name IN ('PRO', 'ENTERPRISE')")
