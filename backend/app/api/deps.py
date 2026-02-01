from typing import Optional, Union
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import verify_token, hash_api_key
from app.models.user import User, APIKey

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    api_key: Optional[str] = Depends(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> User:
    if token:
        payload = verify_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        if user.is_banned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account suspended",
            )
        return user
    
    if api_key:
        key_hash = hash_api_key(api_key)
        result = await db.execute(
            select(APIKey)
            .options(selectinload(APIKey.user))
            .where(APIKey.key_hash == key_hash)
        )
        api_key_obj = result.scalar_one_or_none()
        
        if not api_key_obj:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
            )
        
        api_key_obj.last_used = datetime.now(timezone.utc)
        await db.commit()
        
        user = api_key_obj.user
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        if user.is_banned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account suspended",
            )
        return user
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    api_key: Optional[str] = Depends(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    try:
        return await get_current_user(token, api_key, db)
    except HTTPException:
        return None


class ActorInfo:
    def __init__(self, user: User, is_agent: bool = False, agent_name: Optional[str] = None):
        self.user = user
        self.is_agent = is_agent
        self.agent_name = agent_name or f"{user.username}-bot"
    
    @property
    def actor_type(self) -> str:
        return "agent" if self.is_agent else "user"
    
    @property
    def actor_id(self) -> str:
        return str(self.user.id)
    
    @property
    def actor_display_name(self) -> str:
        return self.agent_name if self.is_agent else self.user.username


async def get_actor_info(
    token: Optional[str] = Depends(oauth2_scheme),
    api_key: Optional[str] = Depends(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> ActorInfo:
    if api_key:
        key_hash = hash_api_key(api_key)
        result = await db.execute(
            select(APIKey)
            .options(selectinload(APIKey.user))
            .where(APIKey.key_hash == key_hash)
        )
        api_key_obj = result.scalar_one_or_none()
        
        if not api_key_obj or not api_key_obj.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
            )
        
        api_key_obj.last_used = datetime.now(timezone.utc)
        await db.commit()
        
        return ActorInfo(api_key_obj.user, is_agent=True, agent_name=f"{api_key_obj.user.username}-bot")
    
    user = await get_current_user(token, None, db)
    return ActorInfo(user, is_agent=False)
