from app.core.database import get_sync_db, sync_session_maker
from sqlalchemy.orm import Session


def get_db_session() -> Session:
    return sync_session_maker()
