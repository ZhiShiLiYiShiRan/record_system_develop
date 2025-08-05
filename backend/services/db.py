# backend/services/db.py

from pymongo import MongoClient
from config import MONGO_URI

# 创建 MongoDB 客户端连接
client = MongoClient(MONGO_URI)

# 指定数据库名称
db = client["QCsys"]

# 显式创建用户集合（用于用户登录验证）
users_collection = db["userlist"]

# 通用函数：根据集合名获取集合对象
def get_collection(name: str):
    """
    根据集合名称返回指定集合（表）
    用法：get_collection("qa_bot") 或 get_collection("check_done")
    """
    return db[name]