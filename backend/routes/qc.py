# backend/routes/qc.py

from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile, Query
from fastapi.responses import JSONResponse
from datetime import datetime
from pathlib import Path

from .auth import get_current_user
from config import UPLOAD_BASE, SESSION_CONFIG_PATH
from services.db import get_collection

# 使用 qa_bot 这个 collection 存 QC 信息
qc_collection = get_collection("qa_bot")

router = APIRouter(prefix="/api/qc", tags=["QC"])


def get_current_session() -> str:
    """
    读取 SESSION_CONFIG_PATH 指定的文件以获取当前 session 名称，
    若读取失败则返回空字符串。
    """
    try:
        return Path(SESSION_CONFIG_PATH).read_text(encoding="utf-8").strip()
    except Exception:
        return ""


@router.post("/submit")
async def qc_submit(
    label: str = Form(...),
    number: str = Form(...),
    url: str = Form("(NA)"),
    note: str = Form(...),
    location: str = Form("(NA)"),
    files: list[UploadFile] = File(...),
    user: str = Depends(get_current_user),
):
    # 1) 校验 session
    session = get_current_session()
    if not session:
        raise HTTPException(status_code=400, detail="Current session 未配置")

    # 2) 存 metadata 到 MongoDB
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    doc = {
        "session": session,
        "label": label.upper(),
        "number": number.upper(),
        "url": url,
        "note": note,
        "location": location,
        "user": user,
        "timestamp": timestamp,
        "locked": False,
    }
    qc_collection.insert_one(doc)

    # 3) 保存文件到磁盘
    base_path = Path(UPLOAD_BASE) / session / number.upper()
    base_path.mkdir(parents=True, exist_ok=True)

    # 计算下一个文件序号
    existing = [
        f.stem.split("-")[-1]
        for f in base_path.iterdir()
        if f.is_file()
    ]
    used = [int(x) for x in existing if x.isdigit()]
    next_idx = max(used + [0]) + 1

    saved = 0
    for f in files:
        ext = Path(f.filename).suffix.lower()
        dst = base_path / f"{number.upper()}-{next_idx}{ext}"
        await f.write(dst)   # FastAPI >=0.95 支持 UploadFile.write()
        saved += 1
        next_idx += 1

    return {"status": "ok", "saved": saved}


@router.get("/images")
async def list_images(number: str = Query(...)):
    """
    列出指定编号所有文件名。
    """
    session = get_current_session()
    folder = Path(UPLOAD_BASE) / session / number.upper()
    if not folder.exists():
        return []
    return [f.name for f in folder.iterdir() if f.is_file()]


@router.delete("/images")
async def delete_image(
    number: str = Query(...),
    filename: str = Query(...),
    user: str = Depends(get_current_user),
):
    """
    删除指定编号下的一张图片。
    """
    session = get_current_session()
    path = Path(UPLOAD_BASE) / session / number.upper() / filename
    if path.exists():
        path.unlink()
        return JSONResponse(content="deleted", status_code=200)
    else:
        raise HTTPException(status_code=404, detail="file not found")
