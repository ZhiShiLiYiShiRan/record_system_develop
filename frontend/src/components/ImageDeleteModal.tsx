// 文件: frontend/src/components/ImageDeleteModal.tsx
import { useEffect, useState } from 'react';

export interface ImageDeleteModalProps {
  open: boolean;
  imageUrls: string[]; // 完整 URL 列表
  onClose: () => void;
  onDelete: (filename: string) => Promise<void>; // 真正删除的回调
}

const urlToFilename = (url: string) =>
  decodeURIComponent((url.split('/').pop() || '').split('?')[0]);

function ImageDeleteModal({
  open,
  imageUrls,
  onClose,
  onDelete,
}: ImageDeleteModalProps) {
  const [selection, setSelection] = useState<Set<string>>(new Set()); // 勾选但还没“确认”的
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set()); // 已“确认”待删
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // MOD: 防止重复点击删除
  // 打开/关闭时重置（关闭会清掉所有状态）
  useEffect(() => {
    if (!open) {
      setSelection(new Set());
      setPendingDeletes(new Set());
      setPreviewUrl(null);
      setDeleteMessage(null);
      setIsDeleting(false); // MOD: 重置状态
    }
  }, [open]);

  const toggleSelect = (filename: string) => {
    setSelection(prev => {
      const s = new Set(prev);
      if (s.has(filename)) s.delete(filename);
      else s.add(filename);
      return s;
    });
  };

  const confirmSelection = () => {
    if (!selection.size) return;
    setPendingDeletes(prev => {
      const combined = new Set(prev);
      for (const f of selection) combined.add(f);
      return combined;
    });
    setSelection(new Set());
  };

  const undoPending = (filename: string) => {
    setPendingDeletes(prev => {
      const s = new Set(prev);
      s.delete(filename);
      return s;
    });
  };

  const performDeletes = async () => {
    if (!pendingDeletes.size) return;
    if (!window.confirm(`Are you sure you want to delete ${pendingDeletes.size} images?`)) return;
    
    setIsDeleting(true);
    const success: string[] = [];
    const failed: string[] = [];

    for (const filename of Array.from(pendingDeletes)) {
      try {
        await onDelete(filename);
        success.push(filename);
      } catch (err: unknown) {
        failed.push(filename);
        console.error('删除失败', filename, err);
      }
    }

    if (success.length && failed.length) {
      setDeleteMessage({
        msg: `Successfully deleted ${success.length} images, failed to delete ${failed.length} images`,
        type: 'error',
      });
    } else if (success.length) {
      setDeleteMessage({
        msg: `Deleted ${success.length} images`,
        type: 'success',
      });
    } else if (failed.length) {
      setDeleteMessage({
        msg: `Failed to delete ${failed.length} images`,
        type: 'error',
      });
    }

    // 清空 pending（已执行过）
    setPendingDeletes(new Set());

    // 如果预览的那张被删了，清掉
    if (previewUrl) {
      const prevName = urlToFilename(previewUrl);
      if (success.includes(prevName)) {
        setPreviewUrl(null);
      }
    }
    setIsDeleting(false); // MOD: 允许再次操作
  };

  const cancelAllPending = () => {
    // 撤回所有已确认的 pending（恢复到 selection）
    setSelection(prev => {
      const s = new Set(prev);
      pendingDeletes.forEach(f => s.add(f));
      return s;
    });
    setPendingDeletes(new Set());
  };

  if (!open) return null;

  const pendingCount = pendingDeletes.size;
  const toConfirmCount = selection.size;

    return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-2xl flex flex-col space-y-4">
        <div className="flex justify-between items-start">
          <h2 className="text-lg font-medium">Delete Images</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="关闭">
            ✕
          </button>
        </div>

        {deleteMessage && (
          <div
            className={`p-2 rounded ${
              deleteMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {deleteMessage.msg}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 max-h-[440px] overflow-auto">
            <ul className="space-y-2">
              {imageUrls.map(u => {
                const filename = urlToFilename(u);
                const isPending = pendingDeletes.has(filename);
                const isSelected = selection.has(filename);
                return (
                  <li key={filename} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {!isPending && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(filename)}
                        />
                      )}
                      <button
                        onClick={() => setPreviewUrl(u)}
                        className="text-sm truncate text-left flex-1"
                        style={{ maxWidth: '160px' }}
                        title={filename}
                      >
                        {filename}
                      </button>
                      {isPending && (
                        <span className="text-[10px] ml-1 px-1 bg-yellow-100 text-yellow-800 rounded">
                          Marked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isPending ? (
                        <button
                          onClick={() => undoPending(filename)}
                          className="px-3 py-1 rounded text-sm bg-gray-200"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            toggleSelect(filename);
                          }}
                          className={`px-3 py-1 rounded text-sm ${
                            isSelected ? 'bg-gray-200 text-gray-800' : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Mark for Deletion'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="w-full sm:w-1/3 flex flex-col gap-3">
            <div className="border rounded p-1 flex-1 flex items-center justify-center bg-gray-50 min-h-[120px]">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="max-h-44 object-contain" />
              ) : (
                <div className="text-center text-gray-500 text-sm">Click on the file name on the left to preview</div>
              )}
            </div>
            {previewUrl && (
              <div className="text-sm break-words">
                <div className="font-medium">Preview File Name:</div>
                <div className="truncate" title={urlToFilename(previewUrl)}>
                  {urlToFilename(previewUrl)}
                </div>
                <div className="flex gap-2 mt-1">
                  {pendingDeletes.has(urlToFilename(previewUrl)) ? (
                    <div className="text-xs px-2 py-1 rounded bg-gray-200">Marked for Deletion</div>
                  ) : (
                    <button
                      onClick={() => {
                        setPendingDeletes(prev => new Set(prev).add(urlToFilename(previewUrl)));
                        setSelection(prev => {
                          const s = new Set(prev);
                          s.delete(urlToFilename(previewUrl));
                          return s;
                        });
                      }}
                      className="text-xs bg-red-600 text-white px-2 py-1 rounded"
                    >
                      Mark to delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="text-sm">
            Pending to confirm: {toConfirmCount} images, Marked for Deletion: {pendingCount} images
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={confirmSelection}
              disabled={!toConfirmCount || isDeleting}
              className="bg-yellow-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={performDeletes}
              disabled={!pendingDeletes.size || isDeleting}
              className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : `Delete Selected (${pendingCount})`}
            </button>
            <button onClick={cancelAllPending} className="px-4 py-2 border rounded">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImageDeleteModal;