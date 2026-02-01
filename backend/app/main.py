from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
import logging
import asyncio

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import engine, Base, async_session_maker
from app.core.security import get_password_hash, verify_token
from app.api.v1 import api_router
from app.websocket import manager
from app.models.user import User
from app.models.space import Space

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


async def seed_admin():
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        logger.info("ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin seeding")
        return
    
    async with async_session_maker() as db:
        result = await db.execute(select(User).where(User.is_admin == True))
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            logger.info(f"Admin user already exists: {existing_admin.email}")
            return
        
        result = await db.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            existing_user.is_admin = True
            await db.commit()
            logger.info(f"Promoted existing user to admin: {settings.ADMIN_EMAIL}")
            return
        
        admin_user = User(
            email=settings.ADMIN_EMAIL,
            username=settings.ADMIN_EMAIL.split("@")[0],
            password_hash=get_password_hash(settings.ADMIN_PASSWORD),
            is_admin=True,
            is_active=True,
        )
        db.add(admin_user)
        await db.commit()
        logger.info(f"Created admin user: {settings.ADMIN_EMAIL}")


async def authenticate_websocket(token: str) -> User | None:
    if not token:
        return None
    try:
        payload = verify_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        async with async_session_maker() as db:
            result = await db.execute(select(User).where(User.id == UUID(user_id)))
            user = result.scalar_one_or_none()
            if user and not user.is_banned:
                return user
    except Exception as e:
        logger.warning(f"WebSocket auth failed: {e}")
    return None


async def check_space_access(user_id: UUID, space_id: str) -> bool:
    try:
        space_uuid = UUID(space_id)
        async with async_session_maker() as db:
            result = await db.execute(
                select(Space)
                .options(selectinload(Space.members))
                .where(Space.id == space_uuid)
            )
            space = result.scalar_one_or_none()
            if not space:
                return False
            
            if space.owner_id == user_id:
                return True
            
            for member in space.members:
                if member.id == user_id:
                    return True
            
            return False
    except Exception as e:
        logger.warning(f"Space access check failed: {e}")
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Kanbot API...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    await seed_admin()
    
    yield
    logger.info("Shutting down Kanbot API...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=None if settings.is_production else f"{settings.API_V1_STR}/openapi.json",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:; frame-ancestors 'none'"
    
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "Accept"],
    expose_headers=["X-Total-Count"],
    max_age=600,
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}


@app.websocket("/ws/{space_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    space_id: str,
    token: str = Query(default=None)
):
    user = await authenticate_websocket(token)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    has_access = await check_space_access(user.id, space_id)
    if not has_access:
        await websocket.close(code=4003, reason="Forbidden")
        return
    
    await manager.connect(websocket, space_id)
    
    try:
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=90
                )
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, space_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, space_id)


app.include_router(api_router, prefix=settings.API_V1_STR)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
