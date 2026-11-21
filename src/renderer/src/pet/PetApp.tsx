import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PetConfig, ProcessTabId } from '../../../shared/types'
import {
  playPressSound,
  playReleaseSound,
  playTaskEndSound
} from '../shared/whaleAudio'

const IMAGE_EXT_SET = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])

function isImagePath(p: string): boolean {
  const dot = p.lastIndexOf('.')
  if (dot === -1) return false
  return IMAGE_EXT_SET.has(p.slice(dot + 1).toLowerCase())
}

export function PetApp(): JSX.Element {
  const [petConfig, setPetConfig] = useState<PetConfig | null>(null)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragFileOver, setDragFileOver] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // 轻量提示条（仅在拖入文件或转换完成时短暂出现 3.5 秒，平时完全隐藏）
  const [toastText, setToastText] = useState<string | null>(null)
  const [droppedImgPath, setDroppedImgPath] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const pointerDownRef = useRef<{
    active: boolean
    startX: number
    startY: number
    moved: boolean
  }>({ active: false, startX: 0, startY: 0, moved: false })
  const dragDepthRef = useRef(0)

  const showToast = useCallback((msg: string, ms = 4000) => {
    setToastText(msg)
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastText(null)
      setDroppedImgPath(null)
    }, ms)
  }, [])

  useEffect(() => {
    void window.softcreate.getPetConfig().then((cfg) => {
      setPetConfig(cfg)
    })

    const unsubCfg = window.softcreate.onPetConfigUpdated((cfg) => {
      setPetConfig(cfg)
    })

    const unsubDone = window.softcreate.onJobCompleted((info) => {
      setPetConfig((curr) => {
        if (curr) {
          playTaskEndSound(curr.sound)
        }
        return curr
      })
      const msg =
        info.kind === 'folder'
          ? '✨ ZIP 归档完成！'
          : `✨ ${info.count} 首音乐已转为 ${info.format ?? ''}！`
      showToast(msg, 4500)
    })

    return () => {
      unsubCfg()
      unsubDone()
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [showToast])

  // 处理小鲸鱼本体的指针按下、拖拽与释放
  const handleWhalePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) {
      e.preventDefault()
      e.stopPropagation()
      setMenuOpen((v) => !v)
      return
    }
    if (e.button !== 0) return

    e.currentTarget.setPointerCapture(e.pointerId)
    setPressed(true)
    if (petConfig) {
      playPressSound(petConfig.sound)
    }

    pointerDownRef.current = {
      active: true,
      startX: e.screenX,
      startY: e.screenY,
      moved: false
    }
    void window.softcreate.petDragStart()
  }

  const handleWhalePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = pointerDownRef.current
    if (!st.active) return

    const dx = e.screenX - st.startX
    const dy = e.screenY - st.startY
    if (!st.moved && dx * dx + dy * dy >= 9) {
      st.moved = true
      setDragging(true)
      setMenuOpen(false)
    }
    if (st.moved) {
      void window.softcreate.petDragMove()
    }
  }

  const handleWhalePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    const st = pointerDownRef.current
    if (!st.active) return
    st.active = false

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    setPressed(false)
    setDragging(false)
    if (petConfig) {
      playReleaseSound(petConfig.sound)
    }

    if (st.moved) {
      // 松手后在桌面底层自动执行四边吸附与左贴边水平翻转
      await window.softcreate.petDragEnd()
    } else {
      // 单击小鲸鱼 -> 直接弹出跨平台音乐转换界面
      setMenuOpen(false)
      void window.softcreate.openStudio('converter')
    }
  }

  // 文件拖放处理
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current += 1
    setDragFileOver(true)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setDragFileOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragDepthRef.current = 0
      setDragFileOver(false)
      setDroppedImgPath(null)

      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length === 0) return

      const paths = files.map((f) => window.softcreate.getPathForFile(f))
      if (petConfig) {
        playPressSound(petConfig.sound)
      }

      try {
        const task = await window.softcreate.analyzeDrop(paths)
        if (task.kind === 'unsupported' && paths.length === 1 && isImagePath(paths[0])) {
          setDroppedImgPath(paths[0])
          showToast('检测到图片，点此设为桌宠形象', 7000)
          return
        }
        await window.softcreate.openTask(task)
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 4500)
      }
    },
    [petConfig, showToast]
  )

  const handleSetDroppedImageAsRole = async () => {
    if (!droppedImgPath) return
    const updated = await window.softcreate.importPetImage(droppedImgPath)
    setPetConfig(updated)
    setDroppedImgPath(null)
    showToast('✨ 已换上新桌宠形象！', 3000)
  }

  const activeRole = useMemo(() => {
    if (!petConfig) return { dataUrl: './whale/DSniang1.png', name: '默认小鲸鱼' }
    return (
      petConfig.roles.find((r) => r.id === petConfig.activeRoleId) ??
      petConfig.roles[0] ?? { dataUrl: './whale/DSniang1.png', name: '默认小鲸鱼' }
    )
  }, [petConfig])

  const openStudioTab = (tab: ProcessTabId) => {
    setMenuOpen(false)
    void window.softcreate.openStudio(tab)
  }

  const isFlipped = Boolean(petConfig?.isFlippedLeft)

  return (
    <div
      className={`dshwv-root ${isFlipped ? 'dshwv-left' : ''} ${
        dragging ? 'dshwv-dragging' : ''
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenuOpen((v) => !v)
      }}
    >
      {/* 拖入文件或转换完成时的迷你轻提示（左翻转时自动反向保持文字正向） */}
      {(dragFileOver || toastText) && (
        <div className="dshwv-mini-toast">
          <span>{dragFileOver ? '🎵 松手即可导入转换' : toastText}</span>
          {droppedImgPath && (
            <button
              type="button"
              className="dshwv-inline-btn"
              onClick={(e) => {
                e.stopPropagation()
                void handleSetDroppedImageAsRole()
              }}
            >
              设为形象
            </button>
          )}
        </div>
      )}

      {/* 承载按压 Q 弹缩放的小鲸鱼身体层 */}
      <div className={`dshwv-body ${pressed ? 'dshwv-pressed' : ''}`}>
        <div
          className="dshwv-img-wrap"
          onPointerDown={handleWhalePointerDown}
          onPointerMove={handleWhalePointerMove}
          onPointerUp={(e) => void handleWhalePointerUp(e)}
          title="单击：打开音乐格式转换器 | 按住拖动：四边自动吸附 | 右键：菜单"
        >
          <img
            className="dshwv-img"
            src={activeRole.dataUrl}
            alt={activeRole.name}
            draggable={false}
          />
        </div>
      </div>

      {/* 角上悬停三横线汉堡按钮 ☰（完全复刻你的截图样式） */}
      {!petConfig?.hideMenuBtn && (
        <button
          type="button"
          className={`dshwv-menu-btn ${
            hovered || menuOpen ? 'dshwv-menu-btn-visible' : ''
          }`}
          title="桌宠设置与快捷菜单"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
        >
          <span />
          <span />
          <span />
        </button>
      )}

      {/* 点击 ☰ 或右键弹出的轻量快捷菜单 */}
      {menuOpen && (
        <div
          className="dshwv-menu dshwv-menu-open"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="dshwv-quick-item primary"
            onClick={() => openStudioTab('converter')}
          >
            🎵 跨平台音乐格式转换
          </button>
          <button
            type="button"
            className="dshwv-quick-item"
            onClick={() => openStudioTab('sound-role')}
          >
            🐳 更换桌宠形象 & 音效
          </button>
          <button
            type="button"
            className="dshwv-quick-item"
            onClick={async () => {
              setMenuOpen(false)
              const dir = await window.softcreate.getOutputDir()
              await window.softcreate.openPath(dir)
            }}
          >
            📂 打开转换输出目录
          </button>
          <div className="dshwv-menu-sep" />
          <button
            type="button"
            className="dshwv-quick-item danger"
            onClick={() => void window.softcreate.quitApp()}
          >
            ✕ 退出小鲸鱼
          </button>
        </div>
      )}
    </div>
  )
}
