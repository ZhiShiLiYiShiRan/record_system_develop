// src/pages/QCPage.tsx
import { useState, useEffect } from "react";
import api from "../services/api";

export default function QCPage() {
  const [label, setLabel] = useState("");
  const [number, setNumber] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // 生成本地预览 URL
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreview(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleSubmit = async () => {
    if (!label || !number || !note) return alert("请填写必填项：Label、Number 和 Note");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("label", label);
      form.append("number", number);
      form.append("url", url || "(NA)");
      form.append("note", note);
      form.append("location", location || "(NA)");
      files.forEach((f) => form.append("files", f));

      const res = await api.post("/qc/submit", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(`上传成功，共 ${res.data.saved} 张图片。`);
      // 重置表单
      setLabel(""); setNumber(""); setUrl(""); setNote(""); setLocation(""); setFiles([]); setPreview([]);
    } catch (err: any) {
      alert(err.response?.data?.detail || "上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold">🧾 QC 质检表单</h2>
      <input
        className="w-full p-2 border rounded"
        placeholder="Label (e.g. E)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <input
        className="w-full p-2 border rounded"
        placeholder="Item Number"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
      />
      <input
        className="w-full p-2 border rounded"
        placeholder="Product Link (optional)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <textarea
        className="w-full p-2 border rounded h-24"
        placeholder="QC Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <input
        className="w-full p-2 border rounded"
        placeholder="Location"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <label className="block">
        <span className="text-sm">Upload Images</span>
        <input
          type="file"
          multiple
          accept="image/*"
          className="block w-full mt-1"
          onChange={handleFileChange}
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {preview.map((src, idx) => (
          <div key={idx} className="relative">
            <img src={src} className="w-full h-24 object-cover rounded" />
            <button
              onClick={() => setFiles(files.filter((_, i) => i !== idx))}
              className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-6 h-6 text-center leading-6"
            >×</button>
          </div>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={uploading}
        className="w-full p-3 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "提交质检"}
      </button>
    </div>
  );
}