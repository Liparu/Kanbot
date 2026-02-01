from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import create_engine
from contextlib import contextmanager

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

sync_database_url = settings.DATABASE_URL.replace('+asyncpg', '+psycopg2')
sync_engine = create_engine(sync_database_url, echo=False)
sync_session_maker = sessionmaker(bind=sync_engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


@contextmanager
def get_sync_db():
    session = sync_session_maker()
    try:
        yield session
    finally:
        session.close()
