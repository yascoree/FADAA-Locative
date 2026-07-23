"""insert default admin user

Revision ID: a5ecf50f6eb2
Revises: eff12d67df74
Create Date: 2026-07-21 18:57:52.850121

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = 'a5ecf50f6eb2'
down_revision: Union[str, Sequence[str], None] = 'eff12d67df74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.execute("""
        INSERT INTO utilisateurs (
            nom,
            prenom,
            email,
            mot_de_passe,
            role,
            date_creation,
            statut_compte,
            cree_par_id
        )
        VALUES (
            'Admin',
            'System',
            'admin@gestion-location.com',
            '$2y$10$55CQodkutAbqUWrLkThNkuhWWfcroPlJrSo4qRHVBs/V3AHQJ6Mqy',
            'ADMINISTRATEUR',
            NOW(),
            'ACTIF',
            NULL
        );
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM utilisateurs
        WHERE email = 'admin@gestion-location.com';
    """)