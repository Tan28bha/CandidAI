# Import all models to ensure Alembic detects them
from app.models.base import Base  # noqa
from app.models.user import User  # noqa
# Future models will be imported here
