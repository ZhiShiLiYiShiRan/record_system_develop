# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes import qc
from routes import auth
from routes import record
from routes.record import router as record_router
from fastapi.staticfiles import StaticFiles
from config import UPLOAD_BASE, FRONTEND_ORIGINS
# from routes import users
from routes import stats  # Import the stats module
# Make sure to import UPLOAD_BASE from your config or define it appropriately
from config import UPLOAD_BASE
import os

app = FastAPI()

# 载入配置
from config import IMAGE_ROOT, FRONTEND_ORIGINS


# 配置 CORS：允许前端地址访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS or ["http://192.168.0.228:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# 注册路由
app.include_router(auth.router, prefix="/api")
app.include_router(record.router, prefix="/api/record")
app.include_router(qc.router, prefix="/api/qc")
# app.include_router(users.router, prefix="/api/users")
app.include_router(stats.router, prefix="/api/stats")
# 静态文件（本地图片目录）
app.mount(
    "/api/images",
    StaticFiles(directory=IMAGE_ROOT),
    name="api-images"
)
app.mount(
    "/images", 
    StaticFiles(directory=IMAGE_ROOT), 
    name="images"
)


app.mount("/qc-images", StaticFiles(directory=UPLOAD_BASE), name="qc-images")
@app.get("/")
def read_root():
    return {"message": "Backend is running"}

print("CORS origins:", FRONTEND_ORIGINS)
