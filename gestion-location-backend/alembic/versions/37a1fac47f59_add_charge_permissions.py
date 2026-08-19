"""add VIEW_CHARGE and MANAGE_CHARGE permissions

Revision ID: 37a1fac47f59
Revises: 3f8c1a9d2e4b
Create Date: 2026-08-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = '37a1fac47f59'
down_revision: Union[str, Sequence[str], None] = '3f8c1a9d2e4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    ("VIEW_CHARGE", "Voir les charges"),
    ("MANAGE_CHARGE", "Gérer les charges"),
]


def upgrade() -> None:
    conn = op.get_bind()
    for code, libelle in NEW_PERMISSIONS:
        conn.execute(
            text("""
                INSERT INTO permissions (code, libelle)
                VALUES (:code, :libelle)
                ON CONFLICT (code) DO NOTHING
            """),
            {"code": code, "libelle": libelle},
        )

    # Backfill : les mandats existants doivent voir les charges tout de suite,
    # comme pour les autres permissions VIEW_* accordées par défaut à la création
    # d'un mandat (voir mandat_service.DEFAULT_VIEW_PERMISSIONS).
    conn.execute(
        text("""
            INSERT INTO manager_permissions (mandat_id, permission_id, date_attribution)
            SELECT m.id, p.id, NOW()
            FROM mandats m
            CROSS JOIN permissions p
            WHERE p.code = 'VIEW_CHARGE'
            ON CONFLICT (mandat_id, permission_id) DO NOTHING
        """)
    )


def downgrade() -> None:
    conn = op.get_bind()
    codes = [c for c, _ in NEW_PERMISSIONS]
    conn.execute(text("DELETE FROM permissions WHERE code = ANY(:codes)"), {"codes": codes})
