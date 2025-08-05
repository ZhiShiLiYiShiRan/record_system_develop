# backend/routes/stats.py
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from services.db import get_collection
from typing import List
import traceback

router = APIRouter()

class StatsItem(BaseModel):
    recorder: str
    count: int


@router.get("/qc/daily")
def qc_daily_stats(days: int = Query(14, ge=1, le=90)):
    """
    返回最近 `days` 天的质检数量：
    - total: 每天的质检总数（所有 user 汇总）
    - per_user: 每天每个 user 的数量（用于拆分图）
    """
    try:
        qa_coll = get_collection("qa_bot_test")  # 如果质检在其它 collection，请改这里

        # 统一用多伦多本地时间
        tz = ZoneInfo("America/Toronto")
        today = datetime.now(tz)
        start_date = (today - timedelta(days=days - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end_date = (start_date + timedelta(days=days)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )  # exclusive upper bound

        # 先统一解析 timestamp（可能是 string 或 already date）
        add_parsed_time_stage = {
            "$addFields": {
                "parsedTime": {
                    "$cond": [
                        { "$eq": [ { "$type": "$timestamp" }, "string" ] },
                        {
                            "$dateFromString": {
                                "dateString": "$timestamp",
                                "format": "%Y-%m-%d %H:%M",
                                "timezone": "America/Toronto"
                            }
                        },
                        "$timestamp"
                    ]
                }
            }
        }

        pipeline_base = [
            add_parsed_time_stage,
            {
                "$match": {
                    "parsedTime": {
                        "$gte": start_date,
                        "$lt": end_date
                    }
                }
            },
            {
                "$addFields": {
                    "date": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$parsedTime",
                            "timezone": "America/Toronto"
                        }
                    }
                }
            },
        ]

        # 每天每个 user 的数量
        pipeline_per_user = [
            *pipeline_base,
            {
                "$group": {
                    "_id": {"date": "$date", "user": "$user"},
                    "count": {"$sum": 1},
                }
            },
            {
                "$project": {
                    "date": "$_id.date",
                    "user": "$_id.user",
                    "count": 1,
                    "_id": 0,
                }
            },
            {"$sort": {"date": 1, "user": 1}},
        ]
        per_user = list(qa_coll.aggregate(pipeline_per_user))

        # 每天总数（不分 user）
        pipeline_total = [
            *pipeline_base,
            {
                "$group": {
                    "_id": "$date",
                    "count": {"$sum": 1},
                }
            },
            {
                "$project": {
                    "date": "$_id",
                    "count": 1,
                    "_id": 0,
                }
            },
            {"$sort": {"date": 1}},
        ]
        total = list(qa_coll.aggregate(pipeline_total))

        return {"total": total, "per_user": per_user}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"质检统计接口异常: {e}")


@router.get("/daily", response_model=List[StatsItem])
def daily_stats():
    try:
        col = get_collection("check_done")
        tz = ZoneInfo("America/Toronto")
        now = datetime.now(tz)
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_tomorrow = start_of_today + timedelta(days=1)

        pipeline = [
            # 统一解析 Record_time（string 或 date）
            {
                "$addFields": {
                    "parsedRecordTime": {
                        "$cond": [
                            { "$eq": [ { "$type": "$Record_time" }, "string" ] },
                            {
                                "$dateFromString": {
                                    "dateString": "$Record_time",
                                    "format": "%Y-%m-%d %H:%M",
                                    "timezone": "America/Toronto"
                                }
                            },
                            "$Record_time"
                        ]
                    }
                }
            },
            # 精确范围过滤（今天）
            {
                "$match": {
                    "parsedRecordTime": {
                        "$gte": start_of_today,
                        "$lt": start_of_tomorrow
                    }
                }
            },
            # 按 Recorder 聚合
            {
                "$group": {
                    "_id": "$Recorder",
                    "count": {"$sum": 1}
                }
            },
            {
                "$project": {
                    "recorder": "$_id",
                    "count": 1,
                    "_id": 0
                }
            },
            {"$sort": {"recorder": 1}},
        ]

        data = list(col.aggregate(pipeline))
        # 保证返回字段符合 response_model
        return [{"recorder": d["recorder"], "count": d["count"]} for d in data]

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"统计接口异常: {e}")
