"""add contact_messages table

Revision ID: 229475589f33
Revises: 5db2b8b92c09
Create Date: 2026-07-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '229475589f33'
down_revision: Union[str, Sequence[str], None] = '5db2b8b92c09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'CONTACT_MESSAGE'")

    op.create_table('contact_messages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('prenom', sa.String(length=255), nullable=False),
    sa.Column('nom', sa.String(length=255), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('telephone', sa.String(length=30), nullable=True),
    sa.Column('sujet', sa.String(length=255), nullable=False),
    sa.Column('message', sa.Text(), nullable=False),
    sa.Column('statut', sa.Enum('NOUVEAU', 'TRAITE', name='contact_message_status'), nullable=False),
    sa.Column('date_creation', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_contact_messages_id'), 'contact_messages', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_contact_messages_id'), table_name='contact_messages')
    op.drop_table('contact_messages')
    # PostgreSQL ne permet pas de retirer une valeur d'un enum sans recréer le
    # type et migrer toutes les colonnes qui l'utilisent — hors scope ici.
