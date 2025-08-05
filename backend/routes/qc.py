# backend/routes/qc.py
from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile, Query
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from datetime import datetime
from pathlib import Path
import os

from services.auth import get_current_user  # 假设你已经有登录依赖
from settings import UPLOAD_BASE, SESSION_CONFIG_PATH  # 你自己的配置

router = APIRouter(prefix="/api/qc", tags=["QC"])

# 挂载静态文件（在 main.py 中做一次即可）
# app.mount("/qc-images", StaticFiles(directory=UPLOAD_BASE), name="qc-images")

def get_current_session() -> str:
    try:
        return Path(SESSION_CONFIG_PATH).read_text(encoding="utf-8").strip()
    except:
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
    session = get_current_session()
    if not session:
        raise HTTPException(400, "Current session 未配置")
    # 存 metadata 到 MongoDB（用你已有的 collection）
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    doc = {
        "session": session, "label": label.upper(), "number": number.upper(),
        "url": url, "note": note, "location": location, "user": user,
        "timestamp": timestamp, "locked": False,
    }
    # insert_one 这里省略，假设你已有 db client
    await qc_collection.insert_one(doc)

    # 保存文件
    base_path = Path(UPLOAD_BASE) / session / number.upper()
    base_path.mkdir(parents=True, exist_ok=True)

    # 计算下一个序号
    existing = [f.stem.split("-")[-1] for f in base_path.iterdir() if f.is_file()]
    used = [int(x) for x in existing if x.isdigit()]
    next_idx = max(used + [0]) + 1

    saved = 0
    for f in files:
        ext = Path(f.filename).suffix.lower()
        dst = base_path / f"{number.upper()}-{next_idx}{ext}"
        await f.write(dst)  # FastAPI 0.95+ 支持 UploadFile.write()
        saved += 1
        next_idx += 1

    return {"status": "ok", "saved": saved}

@router.get("/images")
async def list_images(number: str = Query(...)):
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
    session = get_current_session()
    path = Path(UPLOAD_BASE) / session / number.upper() / filename
    if path.exists():
        path.unlink()
        return JSONResponse("deleted", status_code=200)
    else:
        raise HTTPException(404, "file not found")
