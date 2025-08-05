import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RecordStat {
  recorder: string;
  count: number;
}
interface QcPerUserEntry {
  date: string;
  user: string;
  count: number;
}
interface QcResponse {
  total: Array<{ date: string; count: number }>;
  per_user: QcPerUserEntry[];
}

type MergedEntry = {
  name: string;
  recordCount: number;
  qcCount: number;
};

export default function Stats() {
  const [mergedData, setMergedData] = useState<MergedEntry[]>([]);
  const [recordTotal, setRecordTotal] = useState<number>(0);
  const [qcTotal, setQcTotal] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL || "http://192.168.0.228:5100";

    const load = async () => {
      try {
        const [recordRes, qcRes] = await Promise.all([
          fetch(`${base}/api/stats/daily`),
          fetch(`${base}/api/stats/qc/daily?days=1`),
        ]);

        if (!recordRes.ok) throw new Error(`录货统计拉取失败: ${recordRes.statusText}`);
        if (!qcRes.ok) throw new Error(`质检统计拉取失败: ${qcRes.statusText}`);

        const recordsJson: RecordStat[] = await recordRes.json();
        const qcJson: QcResponse = await qcRes.json();

        // 计算录货总量
        const totalRecords = recordsJson.reduce((sum, r) => sum + r.count, 0);
        setRecordTotal(totalRecords);

        // 计算质检总量（假设 total 数组里包含今天的汇总）
        const totalQc = qcJson.total.reduce((sum, t) => sum + t.count, 0);
        setQcTotal(totalQc);

        // per-user 质检
        const qcMap = new Map<string, number>();
        qcJson.per_user.forEach(p => {
          qcMap.set(p.user, p.count);
        });

        // 合并：以名字为 key
        const mergedMap = new Map<string, { recordCount: number; qcCount: number }>();

        recordsJson.forEach(r => {
          mergedMap.set(r.recorder, { recordCount: r.count, qcCount: qcMap.get(r.recorder) ?? 0 });
        });
        qcMap.forEach((qcCount, user) => {
          if (!mergedMap.has(user)) {
            mergedMap.set(user, { recordCount: 0, qcCount });
          }
        });

        const merged: MergedEntry[] = Array.from(mergedMap.entries()).map(
          ([name, { recordCount, qcCount }]) => ({
            name,
            recordCount,
            qcCount,
          })
        );

        setMergedData(merged);
      } catch (e: unknown) {
        console.error("拉取统计出错：", e);
        setError(e instanceof Error ? e.message : "未知错误");
      }
    };

    load();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl mb-2">今日录货 / 质检量对比</h2>

      {/* 文字统计摘要 */}
      <div className="flex gap-6 mb-4">
        <div className="px-4 py-2 bg-gray-100 rounded shadow">
          <div className="text-sm text-gray-600">录货总量</div>
          <div className="text-2xl font-semibold">{recordTotal}</div>
        </div>
        <div className="px-4 py-2 bg-gray-100 rounded shadow">
          <div className="text-sm text-gray-600">质检总量</div>
          <div className="text-2xl font-semibold">{qcTotal}</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-red-600">出错了：{error}</div>
      )}

      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={mergedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" />
          <RechartsXAxis dataKey="name" />
          <RechartsYAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="recordCount" name="录货" fill="#8884d8" />
          <Bar dataKey="qcCount" name="质检" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
