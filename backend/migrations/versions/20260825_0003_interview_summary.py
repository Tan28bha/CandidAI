"""Add session debrief summary to interview sessions."""

from alembic import op
import sqlalchemy as sa


revision = "20260825_0003"
down_revision = "20260822_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_sessions", sa.Column("summary", sa.String(length=4000), nullable=True))


def downgrade() -> None:
    op.drop_column("interview_sessions", "summary")
