from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
    generate_api_key,
    hash_api_key,
    verify_token,
)
from app.core.config import settings
from app.models.user import User, APIKey
from app.schemas.user import (
    UserCreate,
    UserResponse,
    Token,
    APIKeyCreate,
    APIKeyResponse,
    APIKeyCreatedResponse,
)
from app.api.deps import get_current_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=Token)
@limiter.limit("3/minute")
async def register(request: Request, user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )
    
    user = User(
        email=user_data.email,
        username=user_data.username,
        password_hash=get_password_hash(user_data.password),
        language=user_data.language,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    
    return Token(access_token=access_token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    generic_error = "Incorrect email or password"
    
    if user and user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() / 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account locked due to too many failed attempts. Try again in {remaining} minutes.",
        )
    
    if not user or not verify_password(form_data.password, user.password_hash):
        if user:
            user.failed_login_count += 1
            if user.failed_login_count >= settings.MAX_LOGIN_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=generic_error,
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )
    
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is suspended",
        )
    
    user.failed_login_count = 0
    user.locked_until = None
    await db.commit()
    
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    
    return Token(access_token=access_token, user=UserResponse.model_validate(user))


@router.post("/refresh", response_model=Token)
@limiter.limit("10/minute")
async def refresh_token(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    access_token = create_access_token(
        data={"sub": str(current_user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    
    return Token(access_token=access_token, user=UserResponse.model_validate(current_user))


@router.post("/api-keys", response_model=APIKeyCreatedResponse)
async def create_api_key(
    key_data: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw_key = generate_api_key()
    
    api_key = APIKey(
        user_id=current_user.id,
        key_hash=hash_api_key(raw_key),
        name=key_data.name,
        permissions=key_data.permissions or {},
        is_agent=True,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    
    return APIKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        permissions=api_key.permissions,
        is_agent=api_key.is_agent,
        created_at=api_key.created_at,
        last_used=api_key.last_used,
        key=raw_key,
    )


@router.get("/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(APIKey).where(APIKey.user_id == current_user.id))
    return result.scalars().all()


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == current_user.id)
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    
    await db.delete(api_key)
    await db.commit()
