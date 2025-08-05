# backend/services/auth.py
from fastapi import HTTPException, Header
from passlib.context import CryptContext
from services.db import users_collection

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def verify_credentials(username: str, password: str):
    """
    验证用户名和密码，返回 {username, role} 或抛出 HTTPException。
    """
    user = users_collection.find_one({"username": username})
    if not user or not pwd_context.verify(password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="用户名或密码不正确")
    return {"username": user["username"], "role": user["role"]}

async def get_current_user(authorization: str = Header(None)):
    """
    根据 Authorization 头获取当前用户信息。这里将 token 简化为用户名。
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="未认证")
    parts = authorization.split()
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="无效认证头")
    token = parts[1]
    user = users_collection.find_one({"username": token})
    if not user:
        raise HTTPException(status_code=401, detail="无效用户")
    return {"username": user["username"], "role": user["role"]}
