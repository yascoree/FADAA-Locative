"""rework permission catalog to per-resource VIEW/CREATE/UPDATE/DELETE codes

Revision ID: 1ff2a0f1bf83
Revises: 64b8063d2060
Create Date: 2026-07-20 16:31:31.305308

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ff2a0f1bf83'
down_revision: Union[str, Sequence[str], None] = '64b8063d2060'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_PERMISSIONS = [
    ("VOIR", "Consulter", "Voir les biens, lots, baux, échéances, paiements et quittances du propriétaire"),
    ("CREER_BIEN", "Créer un bien", "Ajouter un nouveau bien pour le propriétaire"),
    ("MODIFIER_BIEN", "Modifier un bien", "Modifier un bien existant du propriétaire"),
    ("SUPPRIMER_BIEN", "Supprimer un bien", "Supprimer un bien du propriétaire"),
    ("CREER_LOT", "Créer un lot", "Ajouter un lot à un bien du propriétaire"),
    ("MODIFIER_LOT", "Modifier un lot", "Modifier un lot existant"),
    ("SUPPRIMER_LOT", "Supprimer un lot", "Supprimer un lot"),
    ("CREER_BAIL", "Créer un bail", "Créer un contrat de location"),
    ("MODIFIER_BAIL", "Modifier un bail", "Modifier un contrat de location existant"),
    ("SUPPRIMER_BAIL", "Supprimer un bail", "Supprimer un contrat de location"),
    ("CREER_ECHEANCE", "Créer une échéance", "Ajouter manuellement une échéance à un bail"),
    ("MODIFIER_ECHEANCE", "Modifier une échéance", "Modifier une échéance existante"),
    ("CREER_PAIEMENT", "Enregistrer un paiement", "Enregistrer un paiement sur une échéance"),
    ("MODIFIER_PAIEMENT", "Modifier un paiement", "Modifier un paiement existant"),
]

NEW_PERMISSIONS = [
    # "Voir" est toujours inclus dans un mandat actif : pas besoin de case à cocher
    # pour la lecture, seules les actions d'écriture sont accordées individuellement.
    ("CREATE_PROPERTY", "Créer un bien", "Ajouter un nouveau bien pour le propriétaire"),
    ("UPDATE_PROPERTY", "Modifier un bien", "Modifier un bien existant du propriétaire"),
    ("DELETE_PROPERTY", "Supprimer un bien", "Supprimer un bien du propriétaire"),
    ("CREATE_LOT", "Créer un lot", "Ajouter un lot à un bien du propriétaire"),
    ("UPDATE_LOT", "Modifier un lot", "Modifier un lot existant"),
    ("DELETE_LOT", "Supprimer un lot", "Supprimer un lot"),
    ("CREATE_LEASE", "Créer un bail", "Créer un contrat de location"),
    ("UPDATE_LEASE", "Modifier un bail", "Modifier un contrat de location existant"),
    ("DELETE_LEASE", "Supprimer un bail", "Supprimer un contrat de location"),
    ("CREATE_DUE_DATE", "Créer une échéance", "Ajouter manuellement une échéance à un bail"),
    ("UPDATE_DUE_DATE", "Modifier une échéance", "Modifier une échéance existante"),
    ("CREATE_PAYMENT", "Enregistrer un paiement", "Enregistrer un paiement sur une échéance"),
    ("UPDATE_PAYMENT", "Modifier un paiement", "Modifier un paiement existant"),
]


def _replace_permissions(permissions):
    permissions_table = sa.table(
        "permissions",
        sa.column("code", sa.String),
        sa.column("libelle", sa.String),
        sa.column("description", sa.Text),
    )
    # ON DELETE CASCADE sur manager_permissions.permission_id fait le ménage des
    # attributions existantes en même temps (aucune n'existait encore en prod).
    op.execute("DELETE FROM permissions")
    op.bulk_insert(
        permissions_table,
        [{"code": code, "libelle": libelle, "description": description} for code, libelle, description in permissions],
    )


def upgrade() -> None:
    """Upgrade schema."""
    _replace_permissions(NEW_PERMISSIONS)


def downgrade() -> None:
    """Downgrade schema."""
    _replace_permissions(OLD_PERMISSIONS)
