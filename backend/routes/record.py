# backend/routes/record.py

from fastapi import APIRouter, HTTPException, Query,Request
from fastapi import UploadFile, File, Form
from pydantic import BaseModel, Field
from services.db import get_collection
from bson import ObjectId
from pymongo import ReturnDocument
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional
import os



router = APIRouter()


# 本地存储图片根目录，可通过环境变量覆盖
IMAGE_ROOT = os.getenv("IMAGE_ROOT", "C:/productImage")

# 废弃# 跳过锁定超时时间（秒），超过该时间锁定自动过期
LOCK_TIMEOUT_SECONDS = 300

# --- Pydantic Models for input validation ---
class SkipPayload(BaseModel):
    """
    跳过记录的请求体
    前端调用 /skip 时传入：
    - id: 要跳过的记录 ID
    """
    id: str = Field(..., alias="_id", description="要跳过的记录ID")
    class Config:
        validate_by_name = True

# # 续租锁的请求体
class RenewPayload(BaseModel):
    """
    续租锁的请求体
    前端调用 /renew 时传入：
    - _id: 要续租的记录在 qa_bot 中的 ObjectId
    """
    id: str = Field(..., alias="_id", description="续租锁的记录ID")
    class Config:
        validate_by_name = True

class SubmitPayload(BaseModel):
    """
    提交录入结果的请求体
    前端调用 /submit 时传入包括：
    - _id: 原始记录ID
    - session, label, number, sku, url, price, title, note, description,
      location, imageUrls, batchCode, qa, timestamp, recorder
    """
    id: str                     = Field(..., alias="_id", description="要提交的记录ID")
    Session: str                = Field(..., alias="session", description="批次 ID")
    Label: str                  = Field(..., alias="label", description="标签")
    Number: int                 = Field(..., alias="number", ge=0, description="编号")
    SKU: str                    = Field(..., alias="sku", description="SKU 编号")
    URL: str                    = Field(..., alias="url", description="商品链接")
    Price: float                = Field(0.0, alias="price", description="价格")
    Title: str                  = Field(..., alias="title", description="录货标题")
    Note: str                   = Field(..., alias="note", description="质检备注")
    Description: Dict[str, Any] = Field(..., alias="description")
    Location: str               = Field(..., alias="location", description="录货位置")
    Product_image: List[str]    = Field(..., alias="imageUrls", description="图片列表")
    Batch_code: str             = Field(..., alias="batchCode", description="批次码")
    QA: str                     = Field(..., alias="qa", description="质检人")
    QA_time: str                = Field(..., alias="timestamp", description="质检时间")
    Recorder: str               = Field(..., alias="recorder", description="录货员")
    
    class Config:
        validate_by_name = True

class UnlockPayload(BaseModel):
    """
    解锁记录的请求体
    前端调用 /unlock 时传入：
    - _id: 要解锁的记录在 qa_bot 中的 ObjectId
    """
    id: str = Field(..., alias="_id", description="要解锁的记录ID")
    class Config:
        validate_by_name = True

class UpdateUrlPayload(BaseModel):
    id: str = Field(..., alias="_id", description="要更新的记录ID")
    url: str = Field(..., alias="url", description="新 URL 地址")
    class Config:
        validate_by_name = True

#======工具函数========
# 将 MongoDB 的 ObjectId 转为字符串
def stringify_id(record: dict) -> dict:
    record["_id"] = str(record["_id"])
    return record


# ===========================
# 获取所有可选的 session（批次）列表
# ===========================
@router.get("/sessions")
def list_sessions():
    """
    返回 qa_bot 集合中所有不重复的 session 值，供前端下拉选择
    """
    return get_collection("qa_bot").distinct("session")  # MongoDB distinct 获取不重复字段列表

# ===========================
# 获取当前 session 的状态：总数、锁定数、下一个锁定记录 
# ===========================
@router.get("/status")
def session_status(session: Optional[str] = Query(None)):
    coll = get_collection("qa_bot")
    base = {"session": session} if session else {}
    total = coll.count_documents(base)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=LOCK_TIMEOUT_SECONDS)
    locked = coll.count_documents({**base, "locked": True, "lockedAt": {"$gte": cutoff}})
    next_locked = None
    if locked:
        doc = coll.find({**base, "locked": True, "lockedAt": {"$gte": cutoff}})\
                  .sort("lockedAt", 1).limit(1)[0]
        next_locked = {"_id": str(doc["_id"]),
                       "lockedAt": doc["lockedAt"].astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M")}
    return {"total": total, "locked": locked, "next_locked": next_locked}

# ===========================
# 获取下一条未锁定的记录，并加锁
@router.get("/next")
def get_next_record(session: Optional[str] = Query(None, description="Session ID to filter records"), user: Optional[str] = Query(None, description="Only fetch records for this user")):
    """
    1. 过滤：指定 session（可选），且 doc.locked == False 或者锁已过期
    2. 原子操作 find_one_and_update：设置 locked=True, lockedAt=now
    3. 按 skippedAt, number 排序，优先返回最早跳过或最小编号
    4. 格式化字段并返回
    """


    coll = get_collection("qa_bot")
    base_filter: Dict[str, Any] = {}
    if session:
        base_filter["session"] = session

    now = datetime.now(timezone.utc)

    expired_cutoff = now - timedelta(seconds=LOCK_TIMEOUT_SECONDS)
    # 只获取未锁定的记录,或者锁定时间超过 LOCK_TIMEOUT_SECONDS 的记录
    filter_query = {
        **base_filter,
        "$or": [
            {"locked": False},  # 未锁定的记录
            {"locked": True, "lockedAt": {"$lt": expired_cutoff}},  # 锁过期了
            {"lockedBy": user}
        ]
    }
    # 原子查找并更新锁定时间
    doc = coll.find_one_and_update(
        filter_query,
        {"$set": {
            "locked": True,
            "lockedAt": now,
            "lockedBy": user
        }},
        sort=[("skippedAt", 1), ("number", 1)],
        return_document=ReturnDocument.AFTER
    )
    if not doc:
        raise HTTPException(status_code=404, detail="没有更多记录可供录入")
    # --- 保留 locked 字段，方便前端判断 ---
    stringify_id(doc)
    # 兼容旧字段名
    if "Bach Code" in doc:
        doc["batchCode"] = doc.pop("Bach Code")
    # 格式化 QA 时间
    if "timestamp" in doc:
        try:
            ts = datetime.fromisoformat(doc["timestamp"])
            doc["timestamp"] = ts.strftime("%Y-%m-%d %H:%M")
        except ValueError:
            pass
    # lockedAt 以 ISO 格式返回，使用多伦多时区
    if isinstance(doc.get("lockedAt"), datetime):
        doc["lockedAt"] = doc["lockedAt"].astimezone(ZoneInfo("America/Toronto")).isoformat()
    # 格式化 skippedAt
    if "skippedAt" in doc:
        try:
            skipped_dt = datetime.fromisoformat(doc["skippedAt"])
            doc["skippedAt"] = skipped_dt.strftime("%Y-%m-%d %H:%M")
        except ValueError:
            pass

    return doc
# # ===========================
# # 心跳续租接口
@router.post("/renew")
def renew_lock(payload: dict, user: Optional[str] = Query(None, description="当前登录用户名")):
    # 续租锁定时间
    """
    前端定时调用此接口续租锁定时间，避免过期
    """
    try:
        rid = ObjectId(payload["_id"])
    except:
        raise HTTPException(status_code=422, detail="无效的记录ID")
    
    coll = get_collection("qa_bot")
    now = datetime.now(timezone.utc)
    #2 仅对已锁定的文档更新lockedAt
    res = coll.update_one(
        {"_id": rid, "locked": True, "lockedBy": user},
        {"$set": {"lockedAt": now}}
    )
    if res.matched_count == 0:
        # 如果没有匹配到，说明文档不存在或未锁定
        raise HTTPException(status_code=403, detail="锁续租失败：锁已失效或不是你的锁")
    # 返回当前时间作为续租成功的标志
    return {"message": "锁续租成功", "locked": True, "lockedAt": now.isoformat()}



# 解锁接口：在页面卸载时调用，或特殊需求下手动触发
@router.post("/unlock")
def unlock_record(payload: dict, user: Optional[str] = Query(None, description="当前登录用户名")):
    """
    前端卸载页面或主动取消时调用，重置 locked=False
    """
    # 1. 校验 ID
    try:
        rid = ObjectId(payload["_id"])
    except:
        raise HTTPException(status_code=422, detail="无效的记录ID")

    coll = get_collection("qa_bot")
    doc = coll.find_one({"_id": rid})
    # 2. 尝试 unset，不以 modified_count 判断
    if doc and doc.get("locked") and doc.get("lockedBy") != user:
        raise HTTPException(status_code=403, detail="只能解锁自己锁定的记录！")
    coll.update_one(
        {"_id": rid}, 
        {
            "$set": {"locked": False},
            "$unset": {"lockedAt": "", "lockedBy": ""}  # 清除锁定时间
        }
    )
    # 既然匹配到了 ID，就算成功
    return {"message": "已解锁"}

@router.post("/skip")
def skip_record(payload: dict, user: Optional[str] = Query(None, description="当前登录用户名")):
    """
    将当前记录删除并重插入队列末尾，同时标记 skippedAt
    前端点击跳过时调用
    """
    try:
        rid = ObjectId(payload["_id"])
    except:
        raise HTTPException(status_code=422, detail="无效的记录ID")
    coll = get_collection("qa_bot")
    now = datetime.now(timezone.utc)
    expired_cutoff = now - timedelta(seconds=LOCK_TIMEOUT_SECONDS)
    orig = coll.find_one_and_delete({
        "_id": rid,
        "$or": [
            {"locked": False},
            {"lockedBy": user},
            {"locked": True, "lockedAt": {"$lt": expired_cutoff}}
        ]
    })
    if not orig:
        # 如果没有删除到，可能记录不存在或被他人锁定
        # 先检查记录是否存在
        exists = coll.count_documents({"_id": rid}) > 0
        if not exists:
            raise HTTPException(status_code=404, detail="记录不存在，跳过失败")
        else:
            raise HTTPException(status_code=403, detail="只能跳过自己锁定的记录！")
        
    orig.pop("_id", None)
    orig.pop("locked", None)
    orig.pop("lockedAt", None)
    orig.pop("lockedBy", None)
    orig["locked"] = False
    orig["skippedAt"] = datetime.now(timezone.utc).isoformat()
    coll.insert_one(orig)
    return {"message": "跳过成功"}


# 提交当前录入结果：写入 check_done 并删除
@router.post("/submit")
def submit_record(payload: SubmitPayload, user: Optional[str] = Query(None, description="当前登录用户名")):
    try:
        rid = ObjectId(payload.id)
    except:
        raise HTTPException(422, "无效的记录ID")

    qa_coll = get_collection("qa_bot")
    # 原子地查找并删除，只删除自己锁定的
    orig = qa_coll.find_one_and_delete({"_id": rid, "locked": True, "lockedBy": user})
    if not orig:
        raise HTTPException(403, "只能提交自己锁定的记录，或记录已被移除")

    # 构建要写入 check_done 的文档
    data = payload.dict(by_alias=True, exclude_none=True)
    images = data.pop("imageUrls", [])
    done_doc = {
        "Session": data["session"],
        "Label": data["label"],
        "Number": data["number"],
        "SKU": data["sku"],
        "URL": data["url"],
        "Price": data["price"],
        "Title": data["title"],
        "Note": data["note"],
        "Description": data["description"],
        "Location": data["location"],
        "Product_image": images,
        "Cover_image": images[0] if images else "",
        "Image_count": len(images),
        "Batch_code": data["batchCode"],
        "QA": data["qa"],
        "QA_time": data["timestamp"],
        "Recorder": data["recorder"],
        "Record_time": datetime.now(ZoneInfo("America/Toronto")).strftime("%Y-%m-%d %H:%M"),  # 【修改】改为多伦多本地时间
    }

    done_coll = get_collection("check_done")
    res = done_coll.insert_one(done_doc)
    if not res.inserted_id:
        # 理论上几乎不会发生，除非写入失败
        raise HTTPException(500, "写入 check_done 失败")

    return {"message": "录入成功"}

@router.post("/update_url")
def update_url(payload: UpdateUrlPayload, user: Optional[str] = Query(None, description="当前登录用户名")):
    try:
        rid = ObjectId(payload.id)
    except:
        raise HTTPException(status_code=422, detail="无效的记录ID")
    coll = get_collection("qa_bot")
    res = coll.update_one({"_id": rid}, {"$set": {"url": payload.url}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"message": "URL 更新成功"}
# ===========================
# 列出指定 session 和 number 下的图片文件名
# ===========================
@router.get("/images/{session}/{number}")
def list_image_files(session: str, number: str):
    """
    根据 session（批次）和 number（编号）拼接本地目录，
    列出所有支持的图片文件名
    """
    folder = os.path.join(IMAGE_ROOT, session, number)
    if not os.path.isdir(folder):
        return []
    exts = {".jpg", ".jpeg", ".png", ".webp"}
    files = [f for f in os.listdir(folder) if os.path.isfile(os.path.join(folder, f)) and os.path.splitext(f)[1].lower() in exts]
    return sorted(files)

# ========== 新增接口: 删除图片 ==========
@router.delete("/image/{session}/{number}/{filename}")
def delete_image(session: str, number: str, filename: str):
    """
    删除指定 session/number 下的单个图片文件
    """
    folder = os.path.join(IMAGE_ROOT, session, number)
    file_path = os.path.join(folder, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    os.remove(file_path)
    return {"message": "删除成功"}


# ========== 新增接口：上传图片 ==========
@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    filename: str = Form(...),  # 前端传入：例如 '1130-1'
    session: str = Form(...),   # 新增: 传入当前批次 session
    number: str = Form(...)
):
    """
    接收图片文件，保存到本地目录 {IMAGE_ROOT}/{session}/{number}/{filename}.{ext}
    返回可访问的 URL
    """
    # 构建目录
    folder = os.path.join(IMAGE_ROOT, session, number)
    os.makedirs(folder, exist_ok=True)
    # 推断扩展名并保存
    ext = os.path.splitext(file.filename)[1]
    save_name = f"{filename}{ext}"
    save_path = os.path.join(folder, save_name)
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    # 返回前端可直接访问的路径
    url = f"/api/images/{session}/{number}/{save_name}"
    return {"url": url}