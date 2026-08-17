"""migrate mandats to agence

Replaces Mandat.gestionnaire_id (a specific staff user) with Mandat.agence_id: the
commercial relationship is Agence <-> Propriétaire, not Employé <-> Propriétaire —
see the Agence/AgenceMembre models. Every gestionnaire that currently holds at
least one mandat gets a single-member Agence created for them (role ADMIN), so
existing mandates keep working unchanged and that gestionnaire can later grow
their agence via the collaborator-invite flow. The old gestionnaire_id is kept
as created_by (informational only, never used for authorization).

Revision ID: 0b794f4f6433
Revises: 0f7493bc9851
Create Date: 2026-08-05 10:10:00.000000

"""
from datetime import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy import column, insert, select, table, update


# revision identifiers, used by Alembic.
revision = "0b794f4f6433"
down_revision = "0f7493bc9851"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("mandats", sa.Column("agence_id", sa.Integer(), nullable=True))
    op.add_column("mandats", sa.Column("created_by", sa.Integer(), nullable=True))

    bind = op.get_bind()
    now = datetime.utcnow()

    mandats_t = table(
        "mandats",
        column("gestionnaire_id", sa.Integer),
        column("agence_id", sa.Integer),
        column("created_by", sa.Integer),
    )
    utilisateurs_t = table(
        "utilisateurs", column("id", sa.Integer), column("nom", sa.String), column("prenom", sa.String)
    )
    agences_t = table(
        "agences",
        column("id", sa.Integer),
        column("nom", sa.String),
        column("created_at", sa.DateTime),
        column("updated_at", sa.DateTime),
    )
    agence_membres_t = table(
        "agence_membres",
        column("agence_id", sa.Integer),
        column("utilisateur_id", sa.Integer),
        column("role_agence", sa.String),
        column("statut", sa.String),
        column("created_at", sa.DateTime),
        column("updated_at", sa.DateTime),
    )

    gestionnaire_ids = [
        row[0] for row in bind.execute(select(mandats_t.c.gestionnaire_id).distinct())
    ]

    for gestionnaire_id in gestionnaire_ids:
        utilisateur = bind.execute(
            select(utilisateurs_t.c.nom, utilisateurs_t.c.prenom).where(utilisateurs_t.c.id == gestionnaire_id)
        ).first()
        nom_agence = f"{utilisateur.prenom} {utilisateur.nom}" if utilisateur else f"Agence #{gestionnaire_id}"

        result = bind.execute(
            insert(agences_t).values(nom=nom_agence, created_at=now, updated_at=now).returning(agences_t.c.id)
        )
        agence_id = result.scalar_one()

        bind.execute(
            insert(agence_membres_t).values(
                agence_id=agence_id,
                utilisateur_id=gestionnaire_id,
                role_agence="ADMIN",
                statut="ACTIF",
                created_at=now,
                updated_at=now,
            )
        )

        bind.execute(
            update(mandats_t)
            .where(mandats_t.c.gestionnaire_id == gestionnaire_id)
            .values(agence_id=agence_id, created_by=gestionnaire_id)
        )

    op.alter_column("mandats", "agence_id", nullable=False)
    op.alter_column("mandats", "created_by", nullable=False)

    op.create_foreign_key("fk_mandats_agence_id", "mandats", "agences", ["agence_id"], ["id"])
    op.create_foreign_key("fk_mandats_created_by", "mandats", "utilisateurs", ["created_by"], ["id"])

    # DROP COLUMN sur Postgres supprime aussi la contrainte FK implicite qui ne
    # porte que sur cette colonne (gestionnaire_id -> utilisateurs.id).
    op.drop_column("mandats", "gestionnaire_id")


def downgrade() -> None:
    op.add_column("mandats", sa.Column("gestionnaire_id", sa.Integer(), nullable=True))

    bind = op.get_bind()
    mandats_t = table("mandats", column("gestionnaire_id", sa.Integer), column("created_by", sa.Integer))
    bind.execute(update(mandats_t).values(gestionnaire_id=mandats_t.c.created_by))

    op.alter_column("mandats", "gestionnaire_id", nullable=False)
    op.create_foreign_key(
        "mandats_gestionnaire_id_fkey", "mandats", "utilisateurs", ["gestionnaire_id"], ["id"]
    )

    op.drop_column("mandats", "created_by")
    op.drop_column("mandats", "agence_id")
