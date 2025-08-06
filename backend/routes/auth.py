"""
Authentication routes for the record system.

This module replaces the previous simplistic login that matched
username and plaintext password directly in the database. It uses
the passlib library to securely hash and verify passwords and
JWT (JSON Web Tokens) to issue an access token on successful login.

Clients must send credentials as a form (application/x-www-form-urlencoded)
using the OAuth2PasswordRequestForm fields `username` and `password`.
On success the endpoint returns an access token, token type (bearer),
the user's role and username.  The token can then be used in the
`Authorization: Bearer <token>` header to access protected routes.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from passlib.context import CryptContext
from pydantic import BaseModel

from services.db import users_collection

router = APIRouter()

# 建议将 SECRET_KEY 存储在环境变量或配置中
SECRET_KEY = "change_this_secret_key_before_deploy"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Passlib context for hashing and verifying passwords using bcrypt.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 定义 OAuth2 密码模式，用于令牌验证
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """
    解码 JWT，校验后返回用户名（sub 字段）。
    可用于 Depends 注入，qc 路由中就可拿到 user: str。
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exc
    except jwt.PyJWTError:
        raise credentials_exc
    username = username.strip()
    # 再去数据库确认用户存在
    user = users_collection.find_one({"username": username})
    if user is None:
        raise credentials_exc
    return username

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a hashed password."""
    try:
        ok = pwd_context.verify(plain_password, hashed_password)
        if ok:
            return True
    except Exception:
        ok = False

    # 如果未通过校验，但数据库里看起来是明文（长度小于 60），当作临时兼容
    if not ok and len(hashed_password) < 60 and plain_password == hashed_password:
        # 顺便把明文替换成哈希
        new_hash = pwd_context.hash(plain_password)
        users_collection.update_one({"password": hashed_password},
                                    {"$set": {"password": new_hash}})
        return True
    return False


def create_access_token(data: Dict[str, str],
                        expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


class TokenResponse(BaseModel):
    """Response model returned on successful login."""
    access_token: str
    token_type: str
    role: Optional[str]
    username: str


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    """
    Authenticate a user and return a JWT token.
    Clients must send a form with fields `username` and `password`.
    """
    # Look up the user by username
    user = users_collection.find_one({"username": form_data.username})
    if not user or "password" not in user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    hashed_password = user["password"]
    if not verify_password(form_data.password, hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create a JWT token including the username and role
    access_token = create_access_token(
        data={"sub": user["username"], "role": user.get("role", "")}
    )
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.get("role", ""),
        username=user["username"],
    )
    