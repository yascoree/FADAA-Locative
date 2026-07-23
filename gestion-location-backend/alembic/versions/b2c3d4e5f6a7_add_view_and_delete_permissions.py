"""add VIEW_* permissions and DELETE_DUE_DATE/DELETE_PAYMENT

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-23 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    ("VIEW_PROPERTY", "Voir les biens"),
    ("VIEW_LOT", "Voir les lots"),
    ("VIEW_LEASE", "Voir les baux"),
    ("VIEW_DUE_DATE", "Voir les échéances"),
    ("VIEW_PAYMENT", "Voir les paiements"),
    ("DELETE_DUE_DATE", "Supprimer une échéance"),
    ("DELETE_PAYMENT", "Supprimer un paiement"),
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

    # Backfill: every mandate created BEFORE this migration was relying on the old
    # "viewing comes free with the mandate" behavior. Without granting them the new
    # VIEW_* permissions, they'd instantly lose all read access the moment this
    # deploys. New mandates get the same default via mandat_service.create_mandat.
    view_codes = ["VIEW_PROPERTY", "VIEW_LOT", "VIEW_LEASE", "VIEW_DUE_DATE", "VIEW_PAYMENT"]
    conn.execute(
        text("""
            INSERT INTO manager_permissions (mandat_id, permission_id, date_attribution)
            SELECT m.id, p.id, NOW()
            FROM mandats m
            CROSS JOIN permissions p
            WHERE p.code = ANY(:codes)
            ON CONFLICT (mandat_id, permission_id) DO NOTHING
        """),
        {"codes": view_codes},
    )


def downgrade() -> None:
    conn = op.get_bind()
    codes = [c for c, _ in NEW_PERMISSIONS]
    conn.execute(text("DELETE FROM permissions WHERE code = ANY(:codes)"), {"codes": codes})
