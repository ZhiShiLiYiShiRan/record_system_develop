import { useEffect, useState, useRef } from 'react';

export interface ImageUploadModalProps {
  open: boolean;
  baseNumber: string; // record number, e.g. raw.number
  initialSuffix?: string; // starting suffix, like '1'
  onClose: () => void;
  uploadImage: (file: File, filename?: string) => Promise<string>; // from parent
  onUploaded?: () => void; // notify parent to refresh
  onSuffixChange?: (suffix: string) => void; // optional sync back to parent
}

type UploadEntry = {
  filename: string;
  status: 'uploading' | 'success' | 'error';
  message?: string;
  url?: string;
};

const clampSuffix = (s: string) => {
  const n = parseInt(s, 10);
  if (isNaN(n) || n < 1) return '1';
  if (n > 9) return '9';
  return String(n);
};

const allowedExts = ['jpg', 'jpeg', 'png'];
const isAllowedImage = (file: File) => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return allowedExts.includes(ext);
};

const ImageUploadModal = ({
  open,
  baseNumber,
  initialSuffix = '1',
  onClose,
  uploadImage,
  onUploaded,
  onSuffixChange,
}: ImageUploadModalProps) => {
  // suffix digit, auto-increments 1..9
  const [suffix, setSuffix] = useState<string>(clampSuffix(initialSuffix));
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // hold latest callback to avoid putting it into effect deps directly
  const onSuffixChangeRef = useRef<ImageUploadModalProps['onSuffixChange']>(undefined);
  useEffect(() => {
    onSuffixChangeRef.current = onSuffixChange;
  }, [onSuffixChange]);

  // avoid syncing back on initial mount
  const isFirstSuffixSync = useRef(true);
  useEffect(() => {
    if (isFirstSuffixSync.current) {
      isFirstSuffixSync.current = false;
      return;
    }
    onSuffixChangeRef.current?.(suffix);
  }, [suffix]);

  // open 初次展开时初始化 suffix & uploads
  useEffect(() => {
    if (open) {
      setSuffix(clampSuffix(initialSuffix));
      setUploads([]);
    }
  }, [open, initialSuffix]);

  // initialSuffix 变更时（比如 parent 改了 suffix），同步但不重置 uploads
  useEffect(() => {
    setSuffix(prev => {
      const clamped = clampSuffix(initialSuffix);
      return prev === clamped ? prev : clamped;
    });
  }, [initialSuffix]);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const incrementSuffix = () => {
    setSuffix(prev => {
      const n = parseInt(prev, 10);
      if (isNaN(n)) return '1';
      const next = n >= 9 ? 1 : n + 1;
      return String(next);
    });
  };

  // 处理单个文件上传（仅成功时自增）
  const handleSingleFile = async (file: File) => {
    const filename = `${baseNumber}-${suffix}`;
    setUploads(prev => [
      ...prev,
      { filename, status: 'uploading' as const },
    ]);
    try {
      const url = await uploadImage(file, filename);
      setUploads(prev =>
        prev.map(u =>
          u.filename === filename
            ? { ...u, status: 'success', url, message: 'Uploaded' }
            : u
        )
      );
      if (onUploaded) {
        await onUploaded(); // 等待父组件刷新完 imageUrls
      }
      incrementSuffix();
    } catch (err: unknown) {
      console.error('Upload failed for', filename, err);
      let errorMessage = 'Upload failed';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setUploads(prev =>
        prev.map(u =>
          u.filename === filename
            ? {
                ...u,
                status: 'error',
                message: errorMessage,
              }
            : u
        )
      );
      // 不自增
    }
  };

  // 多文件入口：过滤不支持格式，分别反馈
  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setUploads(prev => [
          ...prev,
          {
            filename: file.name,
            status: 'error',
            message: 'Not an image',
          },
        ]);
        continue;
      }
      if (!isAllowedImage(file)) {
        setUploads(prev => [
          ...prev,
          {
            filename: file.name,
            status: 'error',
            message: 'Unsupported format (only jpg/jpeg/png)',
          },
        ]);
        continue;
      }
      await handleSingleFile(file);
    }
  };

  // input file change
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const list = Array.from(e.target.files);
    await handleFiles(list);
    // allow selecting same file again
    e.target.value = '';
  };

  // drag & drop handlers
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      await handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  // paste screenshot
  const onPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!e.clipboardData) return;
    const items = Array.from(e.clipboardData.items);
    const images = items.filter(it => it.type.startsWith('image/'));
    if (!images.length) return;
    for (const item of images) {
      const file = item.getAsFile();
      if (file) {
        if (!isAllowedImage(file)) {
          setUploads(prev => [
            ...prev,
            {
              filename: file.name,
              status: 'error',
              message: 'Unsupported format (only jpg/jpeg/png)',
            },
          ]);
          break;
        }
        await handleSingleFile(file);
        break; // only first
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white p-6 rounded shadow-lg w-full max-w-lg flex flex-col space-y-4"
        aria-label="upload modal"
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <h2 className="text-lg font-medium">Upload Images</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
          >
            ✕
          </button>
        </div>

        {/* Filename / suffix control */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="font-medium">{baseNumber}-</span>
            <input
              aria-label="Suffix digit"
              type="text"
              value={suffix}
              maxLength={1}
              onChange={e => setSuffix(clampSuffix(e.target.value))}
              className="w-12 border rounded px-2 py-1"
              inputMode="numeric"
            />
            <span className="text-sm text-gray-600">(auto increments on success)</span>
          </div>
        </div>

        {/* File select / drop / paste area */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onPaste={onPaste}
          className={`p-4 border border-dashed rounded flex flex-col gap-3 text-center ${
            isDragging ? 'bg-gray-50 border-blue-400' : 'bg-white'
          }`}
        >
          <div className="text-sm font-medium">Paste screenshot, drag & drop, or select files</div>
          <div className="flex justify-center">
            <label className="cursor-pointer inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
              Select Image(s)
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                multiple
                onChange={onFileChange}
                className="hidden"
                aria-label="Select image files"
              />
            </label>
          </div>
          <div className="text-xs text-gray-500">
            Only .jpg .jpeg .png are allowed. You can paste an image (Ctrl+V / ⌘+V), drop files here, or choose manually.
          </div>
        </div>

        {/* Upload status list */}
        {uploads.length > 0 && (
          <div className="max-h-48 overflow-auto border rounded p-2">
            <div className="text-sm font-medium mb-2">Recent uploads</div>
            <ul className="space-y-1 text-sm">
              {uploads.map(u => (
                <li key={u.filename} className="flex justify-between items-center">
                  <div className="truncate flex-1" title={u.filename}>
                    {u.filename}
                  </div>
                  <div className="flex gap-2 items-center">
                    {u.status === 'uploading' && <span className="text-blue-600">Uploading...</span>}
                    {u.status === 'success' && <span className="text-green-600">Done</span>}
                    {u.status === 'error' && (
                      <span className="text-red-600">{u.message || 'Error'}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageUploadModal;
