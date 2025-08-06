// src/pages/RecordForm.tsx
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import ImageDeleteModal from '../components/ImageDeleteModal'; // 路径按你项目调整
import ImageUploadModal from '../components/ImageUploadModal'; // 路径按你项目调整
import ImageZoomModal from '../components/ImageZoomModal';
import api from '../services/api';

// 基础 API 地址
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const RECORD_API = `${API_BASE_URL}/api/record`
const IMAGE_API = `${API_BASE_URL}/api/images`

interface RawRecordData {
  _id: string
  session: string
  label: string
  number: string
  url: string
  sku: string
  note: string
  location: string
  user: string
  timestamp: string
  batchCode: string
  locked: boolean
  lockedAt?: string // ISO 格式的时间字符串
}

interface RecordFormData {
  title: string
  description: string
  imageUrls: string[]
  raw: RawRecordData
}

type SessionSelectorCardProps = {
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  showLogout?: boolean;
  onLogout?: () => void;
  selectLabel?: string;
};

const SessionSelectorCard = ({
  title,
  selectLabel = 'Session',
  options,
  value,
  onChange,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  showLogout = false,
  onLogout,
}: SessionSelectorCardProps) => (
  <div className="min-h-screen flex items-center justify-center px-4">
    <div className="bg-white shadow rounded-lg p-6 w-full max-w-md">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{selectLabel}</label>
          <div className="flex gap-2">
            <select
              value={value}
              onChange={e => onChange(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
            >
              <option value="">{`-- Select ${selectLabel} --`}</option>
              {options.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {showLogout && onLogout && (
              <div>
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  </div>
);


export default function RecordForm() {
  // hook 区域

  // Sessions state
  
  const [sessions, setSessions] = useState<string[]>([])
  const [selectedSession, setSelectedSession] = useState<string>('')

  // 临时存储 session 下拉菜单
  const [sessionChoice, setSessionChoice] = useState<string>('')
  const [noMore,setNoMore] = useState(false)
  const [lockedInfo,setLocked] = useState<{_id:string, lockedAt: string} | null>(null)
  const [availSessions, setAvailSessions] = useState<string[]>([])

  // 记录数据状态
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [data, setData] = useState<RecordFormData | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Form fields （商品名称 + LabelNumber）
  const [productName, setProductName] = useState('')
  const MAX_TITLE_LENGTH = 45
  const [suffixTitle, setSuffixTitle] = useState('')
  const suffixLen = suffixTitle.length
  const maxProductNameLength = Math.max(0, MAX_TITLE_LENGTH - suffixLen)
  const productNameRef = useRef<HTMLInputElement | null>(null);
  //mod: 插入 ® 的函数，替换选中或在光标处插入，并保持光标在®之后
  const insertRegisteredSymbol = () => {
    const input = productNameRef.current;
    if (!input) return;
    const start = input.selectionStart ?? productName.length;
    const end = input.selectionEnd ?? productName.length;
    let newVal = productName.slice(0, start) + '®' + productName.slice(end);
    if (newVal.length > maxProductNameLength) {
      // 保证不超过最大长度（优先保留插入的®）
      newVal = newVal.slice(0, maxProductNameLength);
    }
    setProductName(newVal);
    // 等 DOM 更新后恢复焦点和光标位置
    requestAnimationFrame(() => {
      const pos = Math.min(start + 1, maxProductNameLength); // 光标在®之后
      input.focus();
      input.setSelectionRange(pos, pos);
    });
  };
  useEffect(() => {
    if (productName.length > maxProductNameLength) {
      setProductName(productName.slice(0, maxProductNameLength))
      
    }
  }, [productName, maxProductNameLength])

  // description的各个模块状态
  const [desc, setDesc] = useState('')  // About This Product
  const [showBrandNotice, setShowBrandNotice] = useState<boolean>(false);
  const [brandNotice, setBrandNotice] = useState<string>("");
  const [brandNoticeType, setBrandNoticeType] = useState<"authentic" | "counterfeit">("authentic");
  
  const [specs, setSpecs] = useState('')
  const [conditionDescription, setConditionDescription] = useState('')
  const [inspectionNotes, setInspectionNotes] = useState('')
  // const [buyerNotice, setBuyerNotice] = useState('') // 旧版 已经变成拆开的两部分 
  //新版 
  const [templateBuyerNotice, setTemplateBuyerNotice] = useState('') // 预设 buyer notice
  const [customBuyerNotice, setCustomBuyerNotice] = useState('') // 自定义 buyer notice
  // 合成的最终 buyer notice（用于提交 / 预览）
  const combinedBuyerNotice = useMemo(() => {
    if (templateBuyerNotice && customBuyerNotice) {
      return `${templateBuyerNotice}\n${customBuyerNotice}`
    }
    return templateBuyerNotice || customBuyerNotice || ''
  }, [templateBuyerNotice, customBuyerNotice])

  // const [batchCode, setBatchCode] = useState('')

  // URL 编辑
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [editUrl, setEditUrl] = useState('')
  // 重新加入位置与价格状态
  const [location, setLocation] = useState('')
  const [price, setPrice] = useState(0)

  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)

  // 当前记录 ID
  const currentRecordId = useRef<string | null>(null);
  
  
  // 登出函数
  const navigate = useNavigate()
  // 同步数据更新到 ref
  useEffect(() => {
    currentRecordId.current = data?.raw?._id ?? null
  }, [data?.raw?._id])

  // 模态框状态
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [suffix, setSuffix] = useState('1')
  // modal 容器 ref，自动聚焦以接收 paste
  const modalRef = useRef<HTMLDivElement>(null)

  const handleSuffixChange = useCallback((newSuffix: string) => {
    setSuffix(prev => (prev === newSuffix ? prev : newSuffix));
  }, []);
  
  // 删除图片 Modal 状态 （弃用）
  // const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  // 删除结果提示，仅在删除弹窗内显示 （启用）
  // const [deleteMessage, setDeleteMessage] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  // 通用 alert 状态（上传成功/失败全局提示）
  
  // 图片zoomin zoomout 状态
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  // 受控回调，guard 重复
  const handleZoomIndexChange = useCallback((newIndex: number) => {
    setZoomIndex(prev => (prev === newIndex ? prev : newIndex))
  }, [])
  const handleCloseZoom = useCallback(() => {
    setZoomOpen(false)
  }, [])
  // 图片删除 Modal 状态
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const [alert, setAlert] = useState<{ msg: string; type: 1 | 'success' | 'error' } | null>(null)
  // 用户信息
  const role = localStorage.getItem('userRole') || 'recorder'
  const username = localStorage.getItem('username') || ''
  
  // 预设文案
  const brandTemplateAuthentic =
    "This item is 100% Authentic.";
  const brandTemplateCounterfeit =
    "Unbranded / Not Authenticated.\nBrand not verified. May not be an official/original product.";
  
  const KNOWN_PREFIXES = ['BN', 'NEW', 'LN', 'OB\'', 'OB"'];
  const stripExistingPrefix = (name: string) =>
    name.replace(
      new RegExp(
        `^(?:${KNOWN_PREFIXES
          .map((p) => p.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
          .join('|')})-`
      ),
      ''
    )
  const applyPrefix = (name: string, prefix: string) => {
    const stripped = stripExistingPrefix(name)
    return stripped ? `${prefix}-${stripped}` : prefix
  }

  const conditionPresets = [
    {
      label: 'BN',
      shortText: 'Brand New(Unused; packaging unopened or in original factory packaging.). ',
      buyerNotice: '',
    },
    {
      label: 'NEW',
      shortText: 'New (Opened for inspection. May be missing some original packaging. Opened but unused; appearance is flawless.)',
      buyerNotice:
        '',
    },
    {
      label: 'LN',
      shortText: 'Like New(Open box. No visible signs of use. Item is in excellent condition.)',
      buyerNotice:
        'The item has been previously opened, inspected, or briefly handled by another customer. It is in functional condition with little to no signs of wear.\nThe packaging may be incomplete, damaged, or non-original, but the item itself remains in good overall condition - closer to new than used.',
    },
    {
      label: 'OB\'',
      shortText: 'Open Box - In Good Condition (Light signs of use. In good condition. May have minor cosmetic imperfections.)',
      buyerNotice:
        'This item has been opened and may show light signs of handling. It is functional. Packaging may be missing or not original. Please refer to photos for actual condition.\nGreat value for a quality item at a fraction of the retail price!',
    },
    {
      label: 'OB"',
      shortText: 'Open Box - In Fair Condition (Visible wear. Fair condition. Signs of use; fully functional but cosmetic condition is fair.)',
      buyerNotice:
        'This item has been opened and may show signs of handling. It is functional. Packaging may be missing or not original. Please refer to photos for actual condition.\nGreat value for a quality item at a fraction of the retail price!',
    },
  ]
  const buyerPresets = [
    {
      label: 'Device Test',
      buyerPreset: 'Device is tested to the best of our ability, but full feature testing is not guaranteed.',
    },

    {
      label: 'Diff Img',
      buyerPreset: 'The first slide is representative. Minor differences in color, model variant. Item received will be of similar quality and condition.',
    },

    {
      label: 'Size',
      buyerPreset: 'Please refer to the dimensions shown in the photos as a general reference. Actual measurements may vary slightly.',
    },
    {
      label: 'review image',
      buyerPreset: 'Please review all photos and descriptions before placing a bid.',
    }
  ]

  // 自动聚焦模态框
  useEffect(() => {
    if (isModalOpen) modalRef.current?.focus()
  }, [isModalOpen])
 

  // MOD: clamp zoomIndex when imageUrls change or modal open to prevent越界
  useEffect(() => {
    if (!zoomOpen) return
    if (!data?.imageUrls) return
    setZoomIndex(prev => {
      if (data.imageUrls.length === 0) return 0
      return Math.min(prev, data.imageUrls.length - 1)
    })
  }, [data?.imageUrls?.length, zoomOpen, data?.imageUrls])

  // session 选择器的退出 不涉及锁
  const handleLogout = () => {
    // 清除角色，跳回登录页
    localStorage.removeItem('userRole')
    localStorage.removeItem('username')
    navigate('/login', { replace: true })
  }

  // 录货页面的 logout，设计锁的问题， 退出时要解锁
  const handleRecordFormLogout = () => {
    // 解锁逻辑
    if (currentRecordId.current){
      fetch(`${RECORD_API}/unlock?user=${username}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id: currentRecordId.current })
      })
      currentRecordId.current = null;
    }
    localStorage.removeItem('lockedRecordId');   // 清理存储的锁 ID
    // 清除角色，跳回登录页
    localStorage.removeItem('userRole')
    localStorage.removeItem('username')

    navigate('/login', { replace: true })
  }

   // 保存新 URL 到后端并更新本地状态 [新增]
  const handleUrlSave = async () => {
    if (!data) return
    try {
      const res = await fetch(`${RECORD_API}/update_url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id: data.raw._id, url: editUrl })
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || '更新 URL 失败')
      }
      // 更新本地数据
      setData(prev => prev ? { ...prev, raw: { ...prev.raw, url: editUrl } } : prev)
      setIsEditingUrl(false)
      setAlert({ msg: 'URL 更新成功', type: 'success' })
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : '更新 URL 失败'
      setAlert({ msg: message, type: 'error' })
    }
  }



  // 上传图片函数
  const uploadImage = async (file: File, filename?: string): Promise<string> => {
    if (!file || !data) return ''
    const formData = new FormData()
    formData.append('file', file)
    if (filename) formData.append('filename', filename)
    formData.append('session', data.raw.session)
    formData.append('number', data.raw.number)

    try {
      const res = await fetch(`${RECORD_API}/upload`, {
      // const res = await fetch(`/api/record/upload`, {
        method: 'POST',
        body: formData,                // ← 一定要用 formData
      })
      if (!res.ok) throw new Error('上传图片失败')
      const { url } = await res.json() // 后端返回 {url: '/images/.../xxx.png'}
      setAlert({ msg: '图片上传成功', type: 'success' })
      return url
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : '图片上传失败'
      setAlert({ msg: message, type: 'error' })
      return ''
    }
  }

  // 从 filename 提取后缀数字，用于排序（-1, -2...），没匹配到排到最后
  // const extractSuffixNum = (filename: string) => {
  //   const m = filename.match(/-(\d+)(?=\.\w+$|$)/);
  //   return m ? parseInt(m[1], 10) : Infinity;
  // };


  // 刷新图片列表
  const session = data?.raw.session
  const number = data?.raw.number
  const fetchImages = useCallback(async () => {
    if (!session || !number) return
    try {
      const res = await fetch(`${RECORD_API}/images/${session}/${number}`)
      if (!res.ok) {
        console.error('fetchImages failed', res.statusText)
        return
      }
      const files: string[] = await res.json()
      const base = `${IMAGE_API}/${session}/${number}`
      const now = Date.now()

      const sorted = files.slice().sort((a, b) => extractSuffixNum(a) - extractSuffixNum(b));
      setData(prev =>
        prev
          ? {
              ...prev,
              imageUrls: sorted.map(f => `${base}/${f}?t=${now}`), // 加 ?t= 破缓存
            }
          : prev
      )
    } catch (err) {
      console.error('刷新图片列表失败', err)
    }
  }, [session, number])

  // 弃用的旧 refreshImages（保留以防旧调用，）
  // const refreshImages = useCallback(async () => {
  //   if (!data) return;
  //   try {
  //     const res = await fetch(
  //       `${RECORD_API}/images/${data.raw.session}/${data.raw.number}`
  //     )
  //     const files: string[] = res.ok ? await res.json() : []
  //     const base = `${IMAGE_API}/${data.raw.session}/${data.raw.number}`
  //     // MOD: 仍然加 cache-busting 以防调用旧函数时缓存残留
  //     const now = Date.now()
  //     setData(prev => prev ? { ...prev, imageUrls: files.map(f => `${base}/${f}?t=${now}`) } : prev)
  //   } catch (err) {
  //     console.error(err)
  //   }
  // }, [data])

  // 添加图片 （弃用 功能已挪入 ImageUploadModal.tsx）
  // const handleAddImage = async (file: File) => {
  //   if (!data) return
  //   const filename = `${data.raw.number}-${suffix}`
  //   const newUrl = await uploadImage(file, filename)
  //   if (newUrl) await refreshImages()    
  //   setIsModalOpen(false)
  // }

    // 删除图片函数 (弃用 功能已挪入 ImageDeleteModal.tsx)
  // const handleDeleteImage = async (filename: string) => {
  //   if (!data) return
  //   try {
  //     const res = await fetch(
  //       `${RECORD_API}/image/${data.raw.session}/${data.raw.number}/${filename}`,
  //       // `/api/record/image/${data.raw.session}/${data.raw.number}/${filename}`,
  //       { method: 'DELETE' }
  //     )
  //     if (!res.ok) throw new Error('删除图片失败')
  //     setDeleteMessage({ msg: '图片删除成功', type: 'success' })
  //     // 乐观更新 state
  //     setData(prev => prev ? { ...prev, imageUrls: prev.imageUrls.filter(u => !u.endsWith(`/${filename}`)) } : prev)
  //   } catch (err: unknown) {
  //     console.error(err)
  //     const message = err instanceof Error ? err.message : '图片删除失败'
  //     setDeleteMessage({ msg: message, type: 'error' })
  //     // 回退：重拉列表
  //     await refreshImages()
  //   }
  // }


  // 更新后的删除图片函数，统一用 fetchImages 刷新（不再乐观 filter）
  const handleDeleteImage = useCallback(
    async (filename: string) => {
      if (!session || !number) return
      try {
        const res = await fetch(
          `${RECORD_API}/image/${session}/${number}/${filename}`,
          { method: 'DELETE' }
        )
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`删除失败 ${res.status} ${text}`)
        }
        setAlert({ msg: '图片删除成功', type: 'success' })
        await fetchImages() // MOD: 统一拉最新列表
      } catch (err: unknown) {
        console.error('删除图片出错', err)
        const message = err instanceof Error ? (err instanceof Error ? err.message : '删除失败') : '删除失败'
        setAlert({ msg: message, type: 'error' })
        await fetchImages() // 兜底同步
      }
    },
    [session, number, fetchImages]
  )


  // 旧版上传图片按钮的逻辑，已经弃用
  // // ========== 模态框中：文件选择 ==========
  // const handleModalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   if (!e.target.files || !data) return;
  //   await handleAddImage(e.target.files[0])
  // }
  // // ========== 模态框中：粘贴截图 ==========
  // const handleModalPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
  //   if (!data) return
  //   for (const item of Array.from(e.clipboardData.items)) {
  //     if (item.type.startsWith('image/')) {
  //       const file = item.getAsFile()
  //       if (file) { await handleAddImage(file); break }
  //     }
  //   }
  // }


  // 获取 sessions
  useEffect(() => {
    setLoadingSessions(true)
    fetch(`${RECORD_API}/sessions`)
    // fetch(`/api/record/sessions`)
      .then(r => r.json())
      .then(list => setSessions(list))
      .catch(err => setFormError(err.message))
      .finally(() => setLoadingSessions(false))
  }, [])



  const extractSuffixNum = (filename: string) => {
    const m = filename.match(/-(\d+)(?=\.\w+$|$)/);
    return m ? parseInt(m[1], 10) : Infinity;
  };
  // 获取下一条记录
  const fetchNext = useCallback(async () => {
    if (currentRecordId.current) {
      try {
        await fetch(`${RECORD_API}/unlock?user=${username}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _id: currentRecordId.current }),
        });
      } catch (err) {
        console.error('释放锁失败:', err);
        // 即使释放失败也不影响继续请求下一条记录
      } finally {
        currentRecordId.current = null;
        localStorage.removeItem('lockedRecordId');
      }
    }
    
    if (!selectedSession) return
    setLoadingData(true)
    setFormError(null)
    setNoMore(false)
    setLocked(null)
    setAvailSessions([])
    setData(null)
    setTemplateBuyerNotice('')
    setCustomBuyerNotice('')
    
    const res = await fetch(`${RECORD_API}/next?session=${selectedSession}&user=${username}`)
    if (res.status === 404) {
      const stat = await fetch(`${RECORD_API}/status?session=${selectedSession}`).then(r => r.json())
      if (stat.locked > 0 && stat.total - stat.locked === 0) {
        // 本Session全锁，检查其他Session
        const other = sessions.filter(s => s !== selectedSession)
        const avail = await Promise.all(
          other.map(async s => {
            const st = await fetch(`${RECORD_API}/status?session=${s}`).then(r => r.json())
            return st.total - st.locked > 0 ? s : null
          })
        )
        const good = avail.filter((x): x is string => !!x)
        if (good.length) {
          setAvailSessions(good)
        } else {
          setLocked(stat.next_locked)
        }
      } else if (stat.total === 0) {
        setNoMore(true)
      } else {
        setLocked(stat.next_locked)
      }
      setLoadingData(false)
      return
    }
    if (!res.ok) {
      setFormError('获取记录失败')
      setLoadingData(false)
      return
    }
    
    try {
      const raw = (await res.json()) as RawRecordData

      // 拆分 Title
      const suffix = `${raw.label}${raw.number}`
      setSuffixTitle(" "+suffix)
      setProductName('')
      //清空描述模块
      setDesc('')
      setShowBrandNotice(false)
      setBrandNotice('')
      setSpecs('')
      setConditionDescription('')
      setInspectionNotes('')
      setTemplateBuyerNotice('')
      setCustomBuyerNotice('')
      // 清空位置和价格
      setLocation(raw.location)
      setPrice(0)

      // 拉取图片列表 统一用 cache-busting fetch image list，和 fetchImages 保持一致逻辑
      const imgRes = await fetch(`${RECORD_API}/images/${raw.session}/${raw.number}`)
      const files: string[] = imgRes.ok ? await imgRes.json() : []
      const base = `${IMAGE_API}/${raw.session}/${raw.number}`
      const now = Date.now()
      // 按后缀数字排序（-1, -2, -3...）
      const sortedFiles = files.slice().sort((a, b) => extractSuffixNum(a) - extractSuffixNum(b));
      const urls = sortedFiles.map(f => `${base}/${f}?t=${now}`); // MOD: 加 ?t= 防缓存
      // 更新 state
      setData({
        raw,
        title: suffix,
        description: '',
        imageUrls: urls,
      })
    } catch (err: unknown) {
      console.error(err)
      if (err instanceof Error) {
        setFormError(err.message || '加载失败')
      } else {
        setFormError('加载失败')
      }
    } finally {
      setLoadingData(false)
    }
  }, [selectedSession, sessions, username])

  // 当 fetchNext 变化时自动调用
  useEffect(() => {
    fetchNext()
  }, [fetchNext])

  // 续租心跳
  useEffect(() => {
    if (!data) return
    const id = data.raw._id

    const renewLock = async () => {
      try {
        const res = await fetch(`${RECORD_API}/renew?user=${username}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _id: id }),
        })
        if (!res.ok) {
          const errMsg = await res.text()
          setFormError('⚠️ 锁已失效：' + errMsg)
          window.alert('锁已失效或不是你的锁，页面将自动刷新！')
          window.location.reload()
          return
        }
        const result = await res.json()
        console.log('✅ 续租成功:', result.lockedAt)
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error('❌ 续租请求失败:', err.message)
        } else {
          console.error('❌ 续租请求失败:', err)
        }
        setFormError('⚠️ 与服务器连接失败，锁可能已释放！请尽快提交或刷新页面。')
        window.alert('与服务器失去联系，页面将自动刷新')
        window.location.reload()
      }
    }

    const interval = setInterval(renewLock, 150000)
    return () => clearInterval(interval)
  }, [data, username])


  useEffect(() => {
    const handleBeforeUnload = () => {
      const id = currentRecordId.current
      if (id) {
        navigator.sendBeacon(
          `${RECORD_API}/unlock?user=${username}`,
          new Blob([JSON.stringify({ _id: id })], { type: 'application/json' })
          )
        }
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
  }, [username])

    // 清理函数：组件卸载时执行解锁
  useEffect(() => {
    return () => {
      if (currentRecordId.current) {
        api.post(`/api/record/unlock?user=${username}`, { _id: currentRecordId.current })
           .catch(err => console.error('解锁失败：', err));
      }
    }
}, [])

  // 提交
  const handleSubmit = () => {
    if (!data || !productName.trim()) {
      setFormError('Please fill in the product name.')
      return
    }
    setFormError(null)
    setIsSubmitting(true)
    const fullTitle = `${productName}${suffixTitle}`
    const descriptionPayload = {
      fullTitle,
      about: desc,
      brandNotice: showBrandNotice ? brandNotice : '',
      specifications: specs,
      conditionDescription,
      inspectionNotes,
      buyerNotice: combinedBuyerNotice,
    }
    fetch(`${RECORD_API}/submit?user=${username}`, {
    // fetch(`/api/record/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _id: data.raw._id,
        session: selectedSession,
        label: data.raw.label,
        number: parseInt(data.raw.number, 10),
        sku: data.raw.sku,
        url: data.raw.url,
        price,
        title: fullTitle,
        note: data.raw.note,
        description: descriptionPayload,
        location,
        imageUrls: data.imageUrls,
        batchCode: data.raw.batchCode,
        qa: data.raw.user,
        timestamp: data.raw.timestamp,
        recorder: username,
      })
    })
      .then(async res => {
      if (!res.ok) {
        const errMsg = await res.text()
        throw new Error(errMsg || '提交失败')
      }
      return res.json()
    })
    .then(() => fetchNext())
    .catch(err => {
      console.error('❌ 提交失败:', err.message)
      setFormError('❌ 提交失败：' + err.message)
    })
    .finally(() => setIsSubmitting(false))
  }


  // 跳过
  const handleSkip = () => {
    if (!data) return
    setIsSkipping(true)
    fetch(`${RECORD_API}/skip?user=${username}`, {
    // fetch(`/api/record/skip`, { 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: data.raw._id })
    })
      .then(fetchNext)
      .catch(err => setFormError(err.message))
      .finally(() => setIsSkipping(false))
  }



    // Session 未加载或无 Session
  if (loadingSessions) return <div className="p-8">加载 Session...</div>
  if (!sessions.length) return <div className="p-8">暂无 Session</div>
  
  // 未选择Session时，使用下拉菜单+确认按钮
  if (!selectedSession) {
    return (
      <SessionSelectorCard
        title="please select a session"
        options={sessions}
        value={sessionChoice}
        onChange={setSessionChoice}
        primaryLabel="Confirm"
        onPrimary={() => setSelectedSession(sessionChoice)}
        primaryDisabled={!sessionChoice}
        showLogout
        onLogout={handleLogout}
      />
    )
  }

  // Session 锁住时下拉+确认切换
  if (availSessions.length) {
    return (
      <div className="p-8 space-y-2">
        <p>当前 Session “{selectedSession}” 下的记录都被锁住，请切换 Session：</p>
        <select
          className="border p-2 rounded"
          value={sessionChoice}
          onChange={e => setSessionChoice(e.target.value)}
        >
          <option value="">-- 切换 Session --</option>
          {availSessions.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          disabled={!sessionChoice}
          onClick={() => { setSelectedSession(sessionChoice) }}
        >切换</button>
      </div>
    )
  }

  if (lockedInfo) {
    return (
      <div className="p-8">
        <p>所有记录均被占用，请稍后重试。</p>
        <p>下一条记录已于 {lockedInfo.lockedAt} 锁定</p>
      </div>
    )
  }

  if (noMore) {
    return (
      <div className="p-8">
        <p>没有更多记录了 🎉</p>
      </div>
    )
  }

  if (loadingData) return <div className="p-8">Loading…</div>
  if (!data) return <div className="p-8">Loading…</div>
  
  
  // 最终渲染

  return (
    <div className="p-8 w-full">
      {/* [新增] 上传/删除 操作 提示弹窗 */}
      {alert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className={`bg-white p-6 rounded shadow-lg w-80 border-2 ${
            alert.type === 'success' ? 'border-green-400' : 'border-red-400'
          }`}>
            <p className="mb-4">{alert.msg}</p>
            <button
              onClick={() => setAlert(null)}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Yes
            </button>
          </div>
        </div>
      )}
      {/* 弹窗显示区 */}
      {alert && (
        <div
          className={`mb-4 p-4 rounded ${alert.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
        >
          {alert.msg}
        </div>
      )}

      {/* Session 选择 */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">Session</label>
        <div className='flex gap-2'>
          <select
            value={selectedSession}
            onChange={e => setSelectedSession(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
          >
            {sessions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button onClick={handleRecordFormLogout}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
          >
            Logout
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {formError && <div className="mb-4 text-red-600">{formError}</div>}

      {/* 页面标题 */}
      <h2 className="text-2xl font-bold mb-6">User: {username}</h2>
      <p className="mb-4"><strong>Role:</strong> {role}</p>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* 原始数据展示 */}
          <div className="bg-gray-100 p-4 rounded text-sm space-y-1">
            <p><strong>Session:</strong> {data.raw.session}</p>
            <p><strong>Label:</strong> {data.raw.label}</p>
            <p><strong>Number:</strong> {data.raw.number}</p>
            <div>
              <strong>URL:</strong>
              {isEditingUrl ? (
                <div className="flex space-x-2 mt-1">
                  <input
                    type="text"
                    value={editUrl}
                    onChange={e => setEditUrl(e.target.value)}
                    className="flex-1 border px-2 py-1 rounded"
                  />
                  <button onClick={handleUrlSave} className="bg-blue-600 text-white px-2 py-1 rounded">
                    save
                  </button>
                  <button onClick={() => { setIsEditingUrl(false); setEditUrl(data.raw.url) }} className="px-2 py-1">
                    cancel
                  </button>
                </div>
              ) : (
                <div className="flex space-x-2 mt-1">
                  <a
                    href={data.raw.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline break-all"
                  >
                    {data.raw.url || '(NA)'}
                  </a>
                  <button onClick={() => setIsEditingUrl(true)} className="text-sm text-blue-600">
                    edit
                  </button>
                </div>
              )}
            </div>
            <p><strong>SKU:</strong> {data.raw.sku}</p>
            <p><strong>Note:</strong> {data.raw.note}</p>
            <p><strong>Location:</strong> {data.raw.location}</p>
            <p><strong>QA:</strong> {data.raw.user}</p>
            <p><strong>QA Time:</strong> {data.raw.timestamp}</p>
          </div>

          {/* 表单输入区 */}
          <div className="space-y-4">
            {/* Title 拆分输入 */}
            <div className="flex space-x-2 items-center">
              <div className="flex flex-1 gap-2">
                <div className="relative flex-1">
                  <input
                    ref={el => {
                      productNameRef.current = el;
                    }}
                    value={productName}
                    onChange={e => {
                    let v = e.target.value;
                      if (v.length > maxProductNameLength) {
                        v = v.slice(0, maxProductNameLength);
                      }
                      setProductName(v);
                    }}
                    placeholder="Product Name"
                    className="w-full border px-2 py-1 rounded"
                    aria-label="Product Name"
                    aria-describedby="title-limit"
                  />
                  <button
                    type="button"
                    onClick={insertRegisteredSymbol}
                    aria-label="Insert ®"
                    className="absolute right-2 top-[200%] -translate-y-1/2 px-2 py-1 text-sm bg-gray-200 rounded"
                  >
                    ®
                  </button>
                </div>
                <input
                  value={suffixTitle}
                  readOnly
                  className="w-48 border px-2 py-1 rounded bg-gray-100"
                />
              </div>
            </div>
            {/* About description */}
            <div>
              <label className="font-medium">About This Product</label>
              <textarea
               value={desc} 
               onChange={e=>setDesc(e.target.value)} 
               placeholder="Describe the product highlights, features..." 
               rows={20}
               className="w-full border px-2 py-1 rounded resize-y" />
            </div>
            {/* Brand Notice */}
            <div className="mb-6">
              <label className="font-medium block mb-1">Brand Authenticity Notice</label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setBrandNoticeType("counterfeit"); //mod: 选中赝品
                    setBrandNotice(brandTemplateCounterfeit);
                    setShowBrandNotice(true);
                  }}
                  className={`px-3 py-1 rounded border ${
                    brandNoticeType === "counterfeit" && showBrandNotice
                      ? "bg-red-100 border-red-500"
                      : "bg-gray-200"
                  }`}
                >
                  Counterfeit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBrandNoticeType("authentic"); //mod: 选中正品
                    setBrandNotice(brandTemplateAuthentic);
                    setShowBrandNotice(true);
                  }}
                  className={`px-3 py-1 rounded border ${
                    brandNoticeType === "authentic" && showBrandNotice
                      ? "bg-green-100 border-green-500"
                      : "bg-gray-200"
                  }`}
                >
                  Authentic
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBrandNotice(false); //mod: 关闭 textarea 并清空
                    setBrandNotice("");
                  }}
                  className="px-3 py-1 rounded bg-gray-300"
                >
                  Close
                </button>
              </div>
                
              {showBrandNotice && (
                <textarea
                  value={brandNotice}
                  onChange={e => setBrandNotice(e.target.value)}
                  className="w-full border px-2 py-1 rounded h-20"
                />
              )}
            </div>

            {/* Specs */}
            <div>
              <label 
                className="font-medium">Specifications (Approx.)</label>
              <textarea
               value={specs} 
               onChange={e=>setSpecs(e.target.value)} 
               placeholder="each line one item E.g. Screen Size: 10.1" 
               className="w-full border px-2 py-1 rounded h-20" 
              />
            </div>
          
            {/* Condition Description */}
            <div>
              <label className="font-medium">Condition Description</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {conditionPresets.map(p => (
                  <button 
                    key={p.label} 
                    onClick={() => {
                      setConditionDescription(p.shortText)
                      setProductName((prev) => applyPrefix(prev, p.label))
                      setTemplateBuyerNotice(p.buyerNotice)
                      // 注意：不动 customBuyerNotice，保留用户已有附加内容
                    }}
                    className="bg-gray-200 px-2 py-1 rounded flex items-center gap-1"
                    title={p.label}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <textarea 
                value={conditionDescription} 
                onChange={e => setConditionDescription(e.target.value)} 
                placeholder="e.g. Brand New / Open Box - Good" 
                className="w-full border px-2 py-1 rounded h-20" />
            </div>
            
            {/* Inspection Notes */}
            <div>
              <label className="font-medium">Inspection Notes</label>
              <textarea
               value={inspectionNotes}
               onChange={e => setInspectionNotes(e.target.value)} 
               placeholder="Packaging / Accessories / Function Test / Warranty" 
               className="w-full border px-2 py-1 rounded h-20" />
            </div>
            
            {/* Buyer Notice */}
            <div>
              <label className="font-medium">Buyer Notice</label>
              {/* 模板部分 */}
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Template Buyer Notice</span>
                  <button
                    type="button"
                    onClick={() => setTemplateBuyerNotice('')} // mod: clear template
                    className="text-xs underline"
                  >Clear</button>
                </div>
                <textarea
                  value={templateBuyerNotice}
                  onChange={e => setTemplateBuyerNotice(e.target.value)}
                  placeholder="Base buyer notice from condition"
                  className="w-full border px-2 py-1 rounded h-16 mt-1"
                />
              {/* 手动部分*/} 
              <div className="mb-2">
                <div className="flex flex-wrap gap-2 mb-2">
                  {buyerPresets.map(p => (
                    <button 
                      key={p.label}
                      onClick={() => 
                        setCustomBuyerNotice(prev => prev ? prev + '\n' + p.buyerPreset : p.buyerPreset) // mod: append to custom
                      } 
                      className="bg-gray-200 px-2 py-1 rounded flex items-center gap-1"
                      title={p.label}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <textarea 
                  value={customBuyerNotice} // mod
                  onChange={e => { 
                    setCustomBuyerNotice(e.target.value) // mod
                  }}
                  placeholder="Additional buyer notice, e.g. 'No returns accepted'" 
                  className="w-full border px-2 py-1 rounded h-24" 
                />
              </div>
            </div>
            
            {/* 位置 & 价格 并列 */}
            <div className="flex items-center space-x-8">
              {/* 位置 */}
              <div className="flex items-center space-x-2">
                <label className="font-medium">Location:</label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Location"
                  className="w-24 border px-2 py-1 rounded"
                />
              </div>
              {/* 价格 */}
              <div className="flex items-center space-x-2">
                <label className="font-medium">Price:</label>
                <input
                  type="number"
                  value={price}
                  onChange={e => setPrice(+e.target.value)}
                  placeholder="Price"
                  className="w-24 border px-2 py-1 rounded text-right"
                />
              </div>
            </div>


              {/* 操作按钮 */}
              <div className="flex gap-6 mt-4">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  onClick={handleSkip}
                  disabled={isSkipping}
                  className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 disabled:opacity-50"
                >
                  {isSkipping ? 'Skipping...' : 'Skip'}
                </button>
              </div>
            </div>
        
            {/* 实时预览区 */}
            <div className="mt-8 p-4 border rounded bg-gray-50">
              <h3 className="text-xl font-bold mb-2">Preview / Preview</h3>
              <p><strong>FULL TITLE:</strong> {productName} {suffixTitle}</p>
              <p className="mt-2"><strong>About:</strong><br />{desc.split('\n').map((ln,i)=><span key={i}>{ln}<br/></span>)}</p>
              {showBrandNotice && <p className="mt-2"><strong>Brand Notice:</strong><br />{brandNotice.split('\n').map((ln,i)=><span key={i}>{ln}<br/></span>)}</p>}
              <p className="mt-2"><strong>Specifications:</strong><br />{specs.split('\n').map((ln,i)=><span key={i}>{ln}<br/></span>)}</p>
              <p className="mt-2"><strong>Condition:</strong><br />{conditionDescription.split('\n').map((ln,i)=><span key={i}>{ln}<br/></span>)}</p>
              <p className="mt-2"><strong>Inspection Notes:</strong><br />{inspectionNotes.split('\n').map((ln,i)=><span key={i}>{ln}<br/></span>)}</p>
              <p className="mt-2"><strong>Buyer Notice:</strong><br />{combinedBuyerNotice.split('\n').map((ln,i)=><span key={i}>{ln}<br/></span>)}</p>
            </div>
        </div>
      </div>  
      {/* 图片预览 & 添加 */}
      <div>
          <div className="flex items-center justify-between mb-4">
            {/* 添加图片按钮 */}
            <button
              type="button"
              onClick={() => { setSuffix('1'); setIsModalOpen(true) }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-4"
            >
              Add Image
            </button>
            {/* 删除图片按钮 */}
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 mb-4"
            >
              Delete Image
            </button>
          </div>

          {/* 图片列表 */}
          <div className="grid grid-cols-3 gap-2">
            {data.imageUrls.map((url, idx) => (
              <img
                key={url}
                src={url}
                alt={`Image ${idx + 1}`}
                className="border rounded"
                onClick={() => {
                setZoomIndex(idx);
                setZoomOpen(true);
            }}
              />
            ))}
          </div>
      </div>
      
      


      {/* 删除图片弹窗 （已弃用， 功能已挪入 ImageDeleteModal.tsx）*/}
      {/* {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-80">
            <h2 className="text-lg font-medium mb-4">删除图片</h2>
            {deleteMessage ? (
              <>
                <div className={`mb-4 p-2 rounded ${deleteMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{deleteMessage.msg}</div>
                <button onClick={() => { setDeleteMessage(null); setIsDeleteModalOpen(false) }} className="bg-blue-600 text-white px-4 py-2 rounded">Yes</button>
              </>
            ) : (
              <>
                <ul className="max-h-64 overflow-auto mb-4">
                  {data.imageUrls.map(url => {
                    const filename = url.split('/').pop() || url
                    return (
                      <li key={filename} className="flex items-center justify-between mb-2">
                        <span className="truncate">{filename}</span>
                        <button onClick={() => handleDeleteImage(filename)} className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">删除</button>
                      </li>
                    )
                  })}
                </ul>
                <button onClick={() => setIsDeleteModalOpen(false)} className="w-full text-center text-blue-600">取消</button>
              </>
            )}
          </div>
        </div>
      )} */}

      {/* 新的删除 modal，功能已挪入 ImageDeleteModal.tsx */}
      <ImageDeleteModal
        open={isDeleteModalOpen}
        imageUrls={data?.imageUrls || []}
        onClose={() => setIsDeleteModalOpen(false)}
        onDelete={async (filename) => {
          await handleDeleteImage(filename)
        }}
      />

      {/* 模态框,已弃用*/}
      {/* {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div
            ref={modalRef}
            className="bg-white p-6 rounded shadow-lg w-80 outline-none"
            onPaste={handleModalPaste}
            tabIndex={0}
          >
            <h2 className="text-lg font-medium mb-4">文件名</h2>
            <div className="flex items-center mb-4">
              <span className="mr-2">{data.raw.number}-</span>
              <input
                type="number"
                value={suffix}
                maxLength={1}
                onChange={e => setSuffix(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-10 border px-2 py-1 rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-2">选择本地文件：</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleModalFileChange}
                className="w-full"
              />
            </div>
            <div className="p-4 border border-dashed text-center text-sm text-gray-500 mb-4">
              粘贴截图到此处
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="w-full text-blue-600"
            >
              取消
            </button>
          </div>
        </div>
      )} */}

      <ImageUploadModal
        open={isModalOpen}
        baseNumber={data?.raw?.number || ''}
        initialSuffix={suffix}
        onClose={() => setIsModalOpen(false)}
        uploadImage={uploadImage}
        onUploaded={async () => {
          await fetchImages(); // 上传完成后刷新列表
        }}
        onSuffixChange={handleSuffixChange}
      />


      <ImageZoomModal
        open={zoomOpen}
        images={data.imageUrls.map(u => ({ url: u }))}
        index={zoomIndex}
        onClose={handleCloseZoom}
        onIndexChange={handleZoomIndexChange}
      />
      </div>
    </div>
  )
}
