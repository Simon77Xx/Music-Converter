import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PetAnimationMode,
  PetConfig,
  PetPresetId,
  PetShapeMode,
  PetThemeColor
} from '../../../shared/types'
import { PetPresetAvatar } from './PetPresets'

const IMAGE_EXT_SET = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'])

function isImagePath(p: string): boolean {
  const dot = p.lastIndexOf('.')
  if (dot === -1) return false
  return IMAGE_EXT_SET.has(p.slice(dot + 1).toLowerCase())
}

const DEFAULT_CONFIG: PetConfig = {
  name: '音律喵',
  presetId: 'cat',
  shapeMode: 'full',
  animation: 'float',
  scale: 1,
  greeting: '将音乐文件或文件夹拖给我吧 ~',
  hideFrame: false,
  theme: 'blue'
}

export function PetApp(): JSX.Element {
  const [dragOver, setDragOver] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [droppedImageCandidate, setDroppedImageCandidate] = useState<string | null>(null)
  const [clickThrough, setClickThrough] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [petConfig, setPetConfig] = useState<PetConfig>(DEFAULT_CONFIG)

  // 使用计数器防止鼠标划过容器内部子元素时触发 dragleave 导致边框闪烁
  const dragDepthRef = useRef(0)

  useEffect(() => {
    void window.softcreate.getPetConfig().then((cfg) => {
      if (cfg) setPetConfig(cfg)
    })
  }, [])

  const updateConfig = async (partial: Partial<PetConfig>) => {
    setPetConfig((prev) => ({ ...prev, ...partial }))
    const saved = await window.softcreate.savePetConfig(partial)
    setPetConfig(saved)
  }

  const handleUploadPhoto = async () => {
    const updated = await window.softcreate.pickPetImage()
    if (updated) {
      setPetConfig(updated)
      setHint('✨ 已成功换上你的专属桌宠照片！')
      setDroppedImageCandidate(null)
    }
  }

  const handleApplyDroppedImage = async (imgPath: string) => {
    try {
      const updated = await window.softcreate.importPetImage(imgPath)
      setPetConfig(updated)
      setDroppedImageCandidate(null)
      setHint('✨ 已将拖入的照片设为桌宠形象！')
    } catch (err) {
      setHint(err instanceof Error ? err.message : String(err))
    }
  }

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current += 1
    setDragOver(true)
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
      setDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragDepthRef.current = 0
      setDragOver(false)
      setHint(null)
      setDroppedImageCandidate(null)

      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length === 0) {
        setHint('未检测到文件，请从资源管理器拖入。')
        return
      }

      const paths = files.map((f) => window.softcreate.getPathForFile(f))

      // 如果正在“定制桌宠”面板中，且拖入了单张图片，直接将该图片设为桌宠照片
      if (customizing && paths.length === 1 && isImagePath(paths[0])) {
        await handleApplyDroppedImage(paths[0])
        return
      }

      try {
        const task = await window.softcreate.analyzeDrop(paths)
        // 如果在主页拖入的是单张图片，询问用户是否想直接用它当桌宠形象
        if (task.kind === 'unsupported' && paths.length === 1 && isImagePath(paths[0])) {
          setDroppedImageCandidate(paths[0])
          setHint('检测到一张图片！你可以直接将它设为桌宠形象：')
          return
        }
        await window.softcreate.openTask(task)
      } catch (err) {
        setHint(err instanceof Error ? err.message : String(err))
      }
    },
    [customizing]
  )

  const toggleThrough = async () => {
    const next = !clickThrough
    setClickThrough(next)
    if (next) {
      setCustomizing(false)
    } else {
      await window.softcreate.setPetIgnoreMouse(false)
    }
  }

  // 当开启点击穿透时，鼠标移入控制栏/拖拽栏时临时关闭穿透
  const handleInteractiveEnter = () => {
    if (clickThrough) {
      void window.softcreate.setPetIgnoreMouse(false)
    }
  }

  const handleInteractiveLeave = () => {
    if (clickThrough) {
      void window.softcreate.setPetIgnoreMouse(true)
    }
  }

  const handleOpenOutputDir = async () => {
    const dir = await window.softcreate.getOutputDir()
    await window.softcreate.openPath(dir)
  }

  const hasCustomPhoto =
    petConfig.presetId === 'custom' && Boolean(petConfig.customImageDataUrl)

  return (
    <div className={`pet-root theme-${petConfig.theme}`}>
      {/* 顶部悬浮控制条 */}
      <div
        className="pet-topbar"
        onMouseEnter={handleInteractiveEnter}
        onMouseLeave={handleInteractiveLeave}
      >
        <div className="pet-drag-handle" title="按住此处拖动桌宠到屏幕任意位置">
          ⠿ {petConfig.name || '桌宠'}
        </div>
        <div className="pet-topbar-actions">
          <button
            type="button"
            className={`pet-pill-btn ${customizing ? 'active' : ''}`}
            title="上传自己的照片或定制桌宠外观"
            onClick={() => {
              setCustomizing((v) => !v)
              setHint(null)
              setDroppedImageCandidate(null)
            }}
          >
            {customizing ? '✓ 完成' : '🎨 定制桌宠'}
          </button>
          <button
            type="button"
            className="pet-icon-btn"
            title="打开转换输出目录 (SoftcreateOutput)"
            onClick={() => void handleOpenOutputDir()}
          >
            📂
          </button>
          <button
            type="button"
            className="pet-icon-btn pet-close-btn"
            title="退出程序"
            onClick={() => void window.softcreate.quitApp()}
          >
            ✕
          </button>
        </div>
      </div>

      {/* 模式 A：桌宠制作与自定义面板 */}
      {customizing ? (
        <div
          className="pet-customizer"
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={handleDrop}
        >
          <div className="cust-header">
            <span>✨ 制作你的专属桌宠</span>
            <button
              type="button"
              className="cust-upload-btn"
              onClick={() => void handleUploadPhoto()}
            >
              📷 上传照片 / GIF
            </button>
          </div>
          <div className="cust-subhint">
            支持 PNG / JPG / GIF 动图 / WebP，也可以直接把照片拖进此窗口
          </div>

          <div className="cust-section">
            <div className="cust-label">形象选择（已上传照片或内置形象）</div>
            <div className="cust-chip-row">
              {(
                [
                  { id: 'custom', label: '🖼️ 我的照片' },
                  { id: 'cat', label: '🐱 音律喵' },
                  { id: 'robot', label: '🤖 赛博音姬' },
                  { id: 'fox', label: '🦊 灵动小狐' },
                  { id: 'headphone', label: '🎧 潮酷耳机' }
                ] as { id: PetPresetId; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`cust-chip ${petConfig.presetId === item.id ? 'active' : ''}`}
                  onClick={() => {
                    if (item.id === 'custom' && !petConfig.customImageDataUrl) {
                      void handleUploadPhoto()
                    } else {
                      void updateConfig({ presetId: item.id })
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cust-section">
            <div className="cust-label">照片裁剪与展示形态</div>
            <div className="cust-chip-row">
              {(
                [
                  { id: 'full', label: '全身立绘 (完整保留)' },
                  { id: 'circle', label: '圆形头像框' },
                  { id: 'rounded-card', label: '拍立得圆角框' }
                ] as { id: PetShapeMode; label: string }[]
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`cust-chip ${petConfig.shapeMode === s.id ? 'active' : ''}`}
                  onClick={() => void updateConfig({ shapeMode: s.id })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cust-section">
            <div className="cust-label">动态活力效果</div>
            <div className="cust-chip-row">
              {(
                [
                  { id: 'float', label: '☁️ 悬浮呼吸' },
                  { id: 'bounce', label: '🎵 节拍摇摆' },
                  { id: 'pulse', label: '💓 律动缩放' },
                  { id: 'none', label: '⏸️ 静止' }
                ] as { id: PetAnimationMode; label: string }[]
              ).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`cust-chip ${petConfig.animation === a.id ? 'active' : ''}`}
                  onClick={() => void updateConfig({ animation: a.id })}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cust-section cust-two-col">
            <div>
              <div className="cust-label">
                桌宠尺寸：{Math.round((petConfig.scale || 1) * 100)}%
              </div>
              <input
                type="range"
                min="0.65"
                max="1.35"
                step="0.05"
                value={petConfig.scale || 1}
                onChange={(e) => void updateConfig({ scale: Number(e.target.value) })}
                className="cust-slider"
              />
            </div>
            <div>
              <div className="cust-label">主题色调</div>
              <div className="cust-color-row">
                {(
                  [
                    { id: 'blue', color: '#38bdf8', title: '天空蓝' },
                    { id: 'pink', color: '#f472b6', title: '樱花粉' },
                    { id: 'emerald', color: '#34d399', title: '薄荷绿' },
                    { id: 'violet', color: '#a78bfa', title: '星夜紫' }
                  ] as { id: PetThemeColor; color: string; title: string }[]
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.title}
                    className={`cust-color-dot ${petConfig.theme === c.id ? 'active' : ''}`}
                    style={{ background: c.color }}
                    onClick={() => void updateConfig({ theme: c.id })}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="cust-section">
            <div className="cust-label">桌宠昵称 & 气泡台词</div>
            <div className="cust-inputs">
              <input
                type="text"
                placeholder="桌宠昵称"
                maxLength={14}
                value={petConfig.name}
                onChange={(e) => void updateConfig({ name: e.target.value })}
                className="cust-input cust-input-name"
              />
              <input
                type="text"
                placeholder="自定义桌宠平时显示的台词..."
                maxLength={40}
                value={petConfig.greeting}
                onChange={(e) => void updateConfig({ greeting: e.target.value })}
                className="cust-input cust-input-greeting"
              />
            </div>
          </div>

          <div className="cust-footer">
            <label className="cust-checkbox">
              <input
                type="checkbox"
                checked={petConfig.hideFrame}
                onChange={(e) => void updateConfig({ hideFrame: e.target.checked })}
              />
              无边框纯桌宠模式（隐藏半透明背景框）
            </label>
          </div>
        </div>
      ) : (
        /* 模式 B：正常桌宠互动与拖放模式 */
        <div
          className={`pet-drop ${dragOver ? 'dragover' : ''} ${
            petConfig.hideFrame ? 'frameless' : ''
          }`}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={handleDrop}
        >
          {/* 顶部对话气泡 */}
          <div className="pet-bubble">
            {dragOver
              ? '✨ 松开鼠标，交给我来处理吧！'
              : petConfig.greeting || '将音乐文件或文件夹拖给我吧 ~'}
          </div>

          {/* 桌宠主体区域（支持缩放与动态动画） */}
          <div
            className={`pet-avatar-stage anim-${petConfig.animation}`}
            style={{
              transform: `scale(${petConfig.scale || 1})`
            }}
          >
            {hasCustomPhoto ? (
              <div className={`pet-photo-wrap shape-${petConfig.shapeMode}`}>
                <img
                  className="pet-custom-img"
                  src={petConfig.customImageDataUrl}
                  alt={petConfig.name}
                />
              </div>
            ) : (
              <div className="pet-svg-wrap">
                <PetPresetAvatar presetId={petConfig.presetId} />
              </div>
            )}
          </div>

          {/* 底部快速提示 */}
          <div className="pet-subhint">
            拖入音频转码压缩 · 拖入文件夹打包 ZIP
          </div>
        </div>
      )}

      {hint && (
        <div className="pet-toast">
          <span>{hint}</span>
          {droppedImageCandidate && (
            <button
              type="button"
              className="pet-toast-action"
              onClick={() => void handleApplyDroppedImage(droppedImageCandidate)}
            >
              ✨ 设为桌宠照片
            </button>
          )}
        </div>
      )}

      <div
        className="pet-tools"
        onMouseEnter={handleInteractiveEnter}
        onMouseLeave={handleInteractiveLeave}
      >
        <label>
          <input type="checkbox" checked={clickThrough} onChange={toggleThrough} />
          点击穿透（移至此处或顶部栏可操作）
        </label>
      </div>
    </div>
  )
}
