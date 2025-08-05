# backend/routes/auth.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.user import LoginRequest
from services.db import users_collection

router = APIRouter()

class LoginResponse(BaseModel):
    success: bool
    role: str
    username: str

@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    # 从数据库查用户
    user = users_collection.find_one({
        "username": request.username,
        "password": request.password
    })

    if not user:
        # 401 会让前端 axios 进入 catch
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    return {
        "success": True,
        "role": user.get("role", ""),
        "username": user.get("username", "")
    }