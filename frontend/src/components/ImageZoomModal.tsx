import { useEffect, useState, useCallback, useRef } from 'react'

interface ImageZoomModalProps {
  open: boolean
  images: { url: string; alt?: string }[]
  index?: number // 受控
  defaultIndex?: number // 非受控初始
  onIndexChange?: (index: number) => void
  onClose: () => void
}

export default function ImageZoomModal({
  open,
  images,
  index,
  defaultIndex = 0,
  onIndexChange,
  onClose,
}: ImageZoomModalProps) {
  const isControlled = index !== undefined
  const [internalIndex, setInternalIndex] = useState<number>(defaultIndex)
  const currentIndex = isControlled ? index! : internalIndex

  // zoom / pan state
  const [scale, setScale] = useState<number>(1)
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const draggingRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const imgContainerRef = useRef<HTMLDivElement | null>(null)

  // 当 uncontrolled 时，把变化通知 parent
  useEffect(() => {
    if (!isControlled) {
      onIndexChange?.(currentIndex)
    }
  }, [currentIndex, onIndexChange, isControlled])

  // 重置 zoom/pan 每次换图或打开
  useEffect(() => {
    if (open) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    }
  }, [currentIndex, open])

  const changeIndex = useCallback(
    (updater: (i: number) => number) => {
      const newIdx = updater(currentIndex)
      if (newIdx === currentIndex) return
      if (isControlled) {
        onIndexChange?.(newIdx)
      } else {
        setInternalIndex(newIdx)
      }
    },
    [currentIndex, isControlled, onIndexChange]
  )

  const prev = useCallback(
    (e?: React.KeyboardEvent | React.MouseEvent) => {
      e?.preventDefault()
      changeIndex(i => (i - 1 + images.length) % images.length)
    },
    [changeIndex, images.length]
  )

  const next = useCallback(
    (e?: React.KeyboardEvent | React.MouseEvent) => {
      e?.preventDefault()
      changeIndex(i => (i + 1) % images.length)
    },
    [changeIndex, images.length]
  )

  // 键盘导航（箭头、小键盘、Escape 关闭）
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'Numpad4') {
        prev()
      } else if (e.code === 'ArrowRight' || e.code === 'Numpad6') {
        next()
      } else if (e.code === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, prev, next, onClose])

  // wheel 缩放
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY
    const factor = delta > 0 ? 1.1 : 0.9
    setScale(prev => {
      let next = prev * factor
      next = Math.min(Math.max(next, 1), 4) // 限制放大倍数 1~4
      return next
    })
  }, [])

  // 双击切换放大 / 复原（以点击点为中心简单近似）
  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const rect = imgContainerRef.current?.getBoundingClientRect()
      if (!rect) return
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      if (scale > 1.1) {
        // 复原
        setScale(1)
        setTranslate({ x: 0, y: 0 })
      } else {
        // 放大到 2 倍，并尝试把点击点移动到中心
        const newScale = 2
        const offsetX = (clickX - rect.width / 2) * (newScale - 1) / newScale
        const offsetY = (clickY - rect.height / 2) * (newScale - 1) / newScale
        setScale(newScale)
        setTranslate({ x: -offsetX, y: -offsetY })
      }
    },
    [scale]
  )

  // 拖拽平移
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (scale <= 1) return
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    draggingRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: translate.x,
      origY: translate.y,
    }
  }, [scale, translate])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    if (e.pointerId !== draggingRef.current.pointerId) return
    const dx = e.clientX - draggingRef.current.startX
    const dy = e.clientY - draggingRef.current.startY
    setTranslate({
      x: draggingRef.current.origX + dx,
      y: draggingRef.current.origY + dy,
    })
  }, [])

  const onPointerUpOrCancel = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    if (e.pointerId !== draggingRef.current.pointerId) return
    draggingRef.current = null
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={e => {
        // 点击背景关闭（点击内部不关闭）
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="relative select-none"
        style={{ maxWidth: '90vw', maxHeight: '90vh', overflow: 'hidden' }}
      >
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onClose()
          }}
          aria-label="Close"
          className="absolute top-2 right-2 text-white bg-black/50 rounded-full p-2 z-10"
        >
          ✕
        </button>

        {/* 图片 展示 */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              prev()
            }}
            aria-label="Previous"
            className="px-4 py-2 text-white select-none"
          >
            ‹
          </button>
          <div className="mx-4 overflow-hidden" style={{ touchAction: 'none' }}>
            <div
              ref={imgContainerRef}
              onWheel={onWheel}
              onDoubleClick={onDoubleClick}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUpOrCancel}
              onPointerCancel={onPointerUpOrCancel}
              className="relative w-full h-full cursor-grab"
              style={{
                width: '100%',
                maxWidth: '1200px', // 可选上限，太大也不好看
                height: 'auto',
                minHeight: 0,
              }}
              onClick={e => e.stopPropagation()} // 防止外层背景点击关闭
            >
              <img
                src={images[currentIndex]?.url}
                alt={images[currentIndex]?.alt || `Image ${currentIndex + 1}`}
                className="object-contain"
                style={{
                  transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                  transition: draggingRef.current ? 'none' : 'transform 0.2s',
                  maxHeight: '80vh',
                  maxWidth: '100%',
                  userSelect: 'none',
                  pointerEvents: 'all',
                }}
                draggable={false}
              />
              <div className="text-center text-sm text-white mt-1 absolute bottom-0 left-1/2 -translate-x-1/2 bg-black/50 px-2 py-1 rounded">
                {currentIndex + 1} / {images.length}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              next()
            }}
            aria-label="Next"
            className="px-4 py-2 text-white select-none"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  )
}
