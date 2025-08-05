import os
from dotenv import load_dotenv

load_dotenv()

# 前端可访问的 origin 列表，逗号分隔
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]

# 本地图片根目录
IMAGE_ROOT = os.getenv("IMAGE_ROOT")

# MongoDB URI
MONGO_URI = os.getenv("MONGO_URI")

# 图片上传的根目录，示例：C:/productImage
UPLOAD_BASE = os.getenv("UPLOAD_BASE", r"C:\productImage")

SESSION_CONFIG_PATH = os.getenv("SESSION_CONFIG_PATH", "config/session.txt")