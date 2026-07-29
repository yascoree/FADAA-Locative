"""add type_bien and move categorie from bien to lot

Revision ID: e3f4a5b6c7d8
Revises: c1d2e3f4a5b6
Create Date: 2026-07-29 00:00:00.000000

Bien now carries a coarse `type` (IMMOBILIER/VEHICULE/MATERIEL/AUTRE) instead of
a direct `categorie_id`. The detailed categorie (Appartement, Villa, Voiture...)
moves down to the Lot, and each Categorie now declares which `type_bien` it
belongs to — so the Lot's categorie choices can be filtered by its parent
Bien's type. Existing Lots are left without a categorie (nothing to infer it
from); existing Biens get their `type` deduced from their former categorie.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f4a5b6c7d8'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


IMMOBILIER_LIBELLES = [
    "Appartement", "Villa", "Studio", "Maison", "Duplex",
    "Bureau", "Local commercial", "Terrain",
]
VEHICULE_LIBELLES = ["Voiture", "Moto", "Scooter", "Camion", "Camionnette", "Bus"]


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE TYPE type_bien AS ENUM ('IMMOBILIER', 'VEHICULE', 'MATERIEL', 'AUTRE')")

    # 1. categories.type_bien — deduced from the seeded libelle groups; anything
    #    else (custom categories an admin may already have added) defaults to
    #    AUTRE and can be re-typed manually from the admin panel afterwards.
    op.add_column('categories', sa.Column('type_bien', sa.Enum(
        'IMMOBILIER', 'VEHICULE', 'MATERIEL', 'AUTRE', name='type_bien'
    ), nullable=True))
    immobilier_list = ", ".join(f"'{l}'" for l in IMMOBILIER_LIBELLES)
    vehicule_list = ", ".join(f"'{l}'" for l in VEHICULE_LIBELLES)
    op.execute(
        f"""
        UPDATE categories
        SET type_bien = CASE
            WHEN libelle IN ({immobilier_list}) THEN 'IMMOBILIER'
            WHEN libelle IN ({vehicule_list}) THEN 'VEHICULE'
            ELSE 'AUTRE'
        END::type_bien
        """
    )
    op.alter_column('categories', 'type_bien', nullable=False)

    # 2. biens.type — deduced from the bien's former categorie, now that every
    #    categorie has a type_bien.
    op.add_column('biens', sa.Column('type', sa.Enum(
        'IMMOBILIER', 'VEHICULE', 'MATERIEL', 'AUTRE', name='type_bien'
    ), nullable=True))
    op.execute(
        """
        UPDATE biens
        SET type = categories.type_bien
        FROM categories
        WHERE categories.id = biens.categorie_id
        """
    )
    op.execute("UPDATE biens SET type = 'AUTRE' WHERE type IS NULL")
    op.alter_column('biens', 'type', nullable=False)
    op.drop_column('biens', 'categorie_id')

    # 3. lots.categorie_id — new, nullable, no data to backfill it from.
    op.add_column('lots', sa.Column('categorie_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_lots_categorie_id', 'lots', 'categories', ['categorie_id'], ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_lots_categorie_id', 'lots', type_='foreignkey')
    op.drop_column('lots', 'categorie_id')

    # biens.categorie_id can't be restored losslessly (the original categorie
    # link is gone) — recreated as nullable, left unset.
    op.add_column('biens', sa.Column('categorie_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_biens_categorie_id', 'biens', 'categories', ['categorie_id'], ['id']
    )
    op.drop_column('biens', 'type')

    op.drop_column('categories', 'type_bien')
    op.execute("DROP TYPE type_bien")
