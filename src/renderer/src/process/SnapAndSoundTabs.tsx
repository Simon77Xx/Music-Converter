import { useEffect, useRef, useState } from 'react'
import type { PetConfig, WhaleRoleItem } from '../../../shared/types'
import {
  decodeAudioUrl,
  encodeAudioBufferSliceToWavDataUrl,
  playAudioUrl,
  playPressSound,
  playReleaseSound,
  playTaskEndSound
} from '../shared/whaleAudio'

function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function SoundAndRoleTab({
  config,
  onSave
}: {
  config: PetConfig
  onSave: (partial: Partial<PetConfig>) => Promise<void>
}): JSX.Element {
  // 260x260 角色静态图裁剪状态
  const [croppingImg, setCroppingImg] = useState<{
    name: string
    dataUrl: string
  } | null>(null)
  const [cropZoom, setCropZoom] = useState<number>(1)
  const [cropFlipX, setCropFlipX] = useState<boolean>(false)
  const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [cropRoleName, setCropRoleName] = useState<string>('自定义角色')
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const loadedImageRef = useRef<HTMLImageElement | null>(null)
  const cropDragRef = useRef<{
    active: boolean
    startX: number
    startY: number
    origX: number
    origY: number
  }>({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 })

  // 音频波形双滑块裁剪状态
  const [audioClipName, setAudioClipName] = useState<string>('')
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [trimStart, setTrimStart] = useState<number>(0)
  const [trimEnd, setTrimEnd] = useState<number>(1)
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // 绘制 260x260 角色裁剪预览
  const drawRoleCropCanvas = () => {
    const canvas = cropCanvasRef.current
    const img = loadedImageRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, 260, 260)
    ctx.save()
    ctx.translate(130 + cropOffset.x, 130 + cropOffset.y)
    if (cropFlipX) ctx.scale(-1, 1)
    ctx.scale(cropZoom, cropZoom)

    const fitScale = Math.min(260 / img.width, 260 / img.height)
    const drawW = img.width * fitScale
    const drawH = img.height * fitScale
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()
  }

  useEffect(() => {
    if (!croppingImg) return
    const img = new Image()
    img.onload = () => {
      loadedImageRef.current = img
      drawRoleCropCanvas()
    }
    img.src = croppingImg.dataUrl
  }, [croppingImg])

  useEffect(() => {
    drawRoleCropCanvas()
  }, [cropZoom, cropFlipX, cropOffset])

  // 绘制音频波形与裁剪选区
  useEffect(() => {
    const canvas = waveCanvasRef.current
    if (!canvas || !audioBuffer) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = '#f3f5fb'
    ctx.fillRect(0, 0, w, h)

    const dur = audioBuffer.duration || 1
    const x1 = (trimStart / dur) * w
    const x2 = (trimEnd / dur) * w
    ctx.fillStyle = 'rgba(32, 49, 112, 0.16)'
    ctx.fillRect(x1, 0, Math.max(2, x2 - x1), h)

    const data = audioBuffer.getChannelData(0)
    const step = Math.ceil(data.length / w)
    ctx.fillStyle = '#203170'
    for (let i = 0; i < w; i++) {
      let min = 1.0
      let max = -1.0
      const startIdx = i * step
      for (let j = 0; j < step && startIdx + j < data.length; j++) {
        const v = data[startIdx + j]
        if (v < min) min = v
        if (v > max) max = v
      }
      const yTop = ((1 - max) / 2) * h
      const yBot = ((1 - min) / 2) * h
      ctx.fillRect(i, yTop, 1, Math.max(1, yBot - yTop))
    }

    ctx.fillStyle = '#c0392b'
    ctx.fillRect(x1, 0, 2, h)
    ctx.fillRect(Math.max(0, x2 - 2), 0, 2, h)
  }, [audioBuffer, trimStart, trimEnd])

  const handleImportRoleClick = async () => {
    const picked = await window.softcreate.pickRawImage()
    if (!picked) return

    if (picked.isGif) {
      const newRole: WhaleRoleItem = {
        id: uid('role'),
        name: picked.name || '自定义动图',
        dataUrl: picked.dataUrl,
        isGif: true,
        builtin: false
      }
      await onSave({
        roles: [...config.roles, newRole],
        activeRoleId: newRole.id
      })
      return
    }

    setCropRoleName(picked.name || '自定义角色')
    setCropZoom(1)
    setCropFlipX(false)
    setCropOffset({ x: 0, y: 0 })
    setCroppingImg({ name: picked.name, dataUrl: picked.dataUrl })
  }

  const handleConfirmRoleCrop = async () => {
    const canvas = cropCanvasRef.current
    if (!canvas) return
    const croppedDataUrl = canvas.toDataURL('image/png')
    const newRole: WhaleRoleItem = {
      id: uid('role'),
      name: cropRoleName.trim() || '自定义角色',
      dataUrl: croppedDataUrl,
      isGif: false,
      builtin: false
    }
    await onSave({
      roles: [...config.roles, newRole],
      activeRoleId: newRole.id
    })
    setCroppingImg(null)
  }

  const handleImportAudioForCrop = async () => {
    const picked = await window.softcreate.pickRawAudio()
    if (!picked) return
    const buf = await decodeAudioUrl(picked.dataUrl)
    if (!buf) return
    setAudioClipName(picked.name)
    setAudioBuffer(buf)
    setTrimStart(0)
    setTrimEnd(Number(Math.min(buf.duration, 4).toFixed(2)))
  }

  const handlePreviewCroppedAudio = () => {
    if (!audioBuffer) return
    const wavUrl = encodeAudioBufferSliceToWavDataUrl(audioBuffer, trimStart, trimEnd)
    void playAudioUrl(wavUrl, config.sound.pressVolume || 0.85)
  }

  const handleApplyCroppedAudio = async (
    slot: 'press' | 'release' | 'taskEnd'
  ) => {
    if (!audioBuffer) return
    const wavUrl = encodeAudioBufferSliceToWavDataUrl(audioBuffer, trimStart, trimEnd)
    if (slot === 'press') {
      await onSave({
        sound: {
          ...config.sound,
          pressSet: 'custom',
          customPressDataUrl: wavUrl
        }
      })
    } else if (slot === 'release') {
      await onSave({
        sound: {
          ...config.sound,
          pressSet: 'custom',
          customReleaseDataUrl: wavUrl
        }
      })
    } else {
      await onSave({
        sound: {
          ...config.sound,
          taskEndSound: 'custom',
          customTaskEndDataUrl: wavUrl
        }
      })
    }
  }

  const snd = config.sound

  return (
    <div className="wstudio-panel">
      {/* 模块一：自定义角色 / GIF 动图 & 挂件尺寸调节 */}
      <div className="wstudio-card">
        <div className="wstudio-card-head">
          <div className="wstudio-card-title">🐳 桌面挂件形象与大小设置</div>
          <button
            type="button"
            className="wstudio-primary-btn"
            onClick={() => void handleImportRoleClick()}
          >
            📷 上传自己的照片 (裁剪) / GIF 动图
          </button>
        </div>

        {/* 角色列表 */}
        <div className="wstudio-role-grid">
          {config.roles.map((r) => {
            const isCur = r.id === config.activeRoleId
            return (
              <div
                key={r.id}
                className={`wstudio-role-card ${isCur ? 'active' : ''}`}
                onClick={() => void onSave({ activeRoleId: r.id })}
              >
                <img src={r.dataUrl} alt={r.name} className="wstudio-role-thumb" />
                <div className="wstudio-role-meta">
                  <span className="wstudio-role-name">{r.name}</span>
                  {r.isGif && <span className="wstudio-gif-tag">GIF</span>}
                </div>
                {!r.builtin && (
                  <button
                    type="button"
                    className="wstudio-role-del"
                    title="删除该角色"
                    onClick={(e) => {
                      e.stopPropagation()
                      const nextRoles = config.roles.filter((x) => x.id !== r.id)
                      const nextActive =
                        config.activeRoleId === r.id
                          ? nextRoles[0]?.id ?? 'builtin-whale'
                          : config.activeRoleId
                      void onSave({ roles: nextRoles, activeRoleId: nextActive })
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* 挂件大小调节 */}
        <div className="wstudio-field-row" style={{ marginTop: 12 }}>
          <label style={{ minWidth: 96, fontWeight: 700 }}>
            挂件大小 ({Math.round(config.scale * 100)}%)
          </label>
          <input
            type="range"
            className="wstudio-range"
            min={0.6}
            max={1.8}
            step={0.1}
            value={config.scale}
            onChange={(e) => void onSave({ scale: Number(e.target.value) })}
          />
          <button
            type="button"
            className="wstudio-mini-btn"
            onClick={() => void onSave({ scale: 1.0 })}
          >
            重置 100%
          </button>
        </div>

        {/* 260x260 角色交互裁剪框 */}
        {croppingImg && (
          <div className="wstudio-crop-box">
            <div className="wstudio-card-title">
              ✂️ 裁剪角色形象（在画布上按住拖动平移，滑块调节缩放）
            </div>
            <div className="wstudio-crop-canvas-wrap">
              <canvas
                ref={cropCanvasRef}
                width={260}
                height={260}
                className="wstudio-crop-canvas"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  cropDragRef.current = {
                    active: true,
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: cropOffset.x,
                    origY: cropOffset.y
                  }
                }}
                onPointerMove={(e) => {
                  const st = cropDragRef.current
                  if (!st.active) return
                  setCropOffset({
                    x: st.origX + (e.clientX - st.startX),
                    y: st.origY + (e.clientY - st.startY)
                  })
                }}
                onPointerUp={() => {
                  cropDragRef.current.active = false
                }}
              />
            </div>

            <div className="wstudio-field-row" style={{ justifyContent: 'center' }}>
              <span>缩放</span>
              <input
                type="range"
                min={0.4}
                max={3.0}
                step={0.05}
                value={cropZoom}
                onChange={(e) => setCropZoom(Number(e.target.value))}
              />
              <button
                type="button"
                className={`wstudio-mini-btn ${cropFlipX ? 'active' : ''}`}
                onClick={() => setCropFlipX((v) => !v)}
              >
                ⇄ 水平翻转
              </button>
              <button
                type="button"
                className="wstudio-mini-btn"
                onClick={() => {
                  setCropZoom(1)
                  setCropOffset({ x: 0, y: 0 })
                }}
              >
                重置位置
              </button>
            </div>

            <div className="wstudio-field-row" style={{ justifyContent: 'center' }}>
              <input
                type="text"
                className="wstudio-input"
                style={{ maxWidth: 160, textAlign: 'center' }}
                value={cropRoleName}
                onChange={(e) => setCropRoleName(e.target.value)}
                placeholder="角色名称"
              />
              <button
                type="button"
                className="wstudio-primary-btn"
                onClick={() => void handleConfirmRoleCrop()}
              >
                ✓ 确认裁剪并设为角色
              </button>
              <button
                type="button"
                className="wstudio-mini-btn"
                onClick={() => setCroppingImg(null)}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 模块二：音效与提示全局设置 + 可视化音频双滑块裁剪 */}
      <div className="wstudio-card">
        <div className="wstudio-card-head">
          <div className="wstudio-card-title">🔊 音效与提示全局设置</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={snd.enabled}
              onChange={(e) =>
                void onSave({ sound: { ...snd, enabled: e.target.checked } })
              }
            />
            启用全局音效
          </label>
        </div>

        {/* ① 按压 & 松开音效 */}
        <div className="wstudio-sound-block">
          <div className="wstudio-field-row">
            <label style={{ minWidth: 96, fontWeight: 700 }}>① 按压/松手音</label>
            <select
              className="wstudio-select"
              value={snd.pressSet}
              onChange={(e) =>
                void onSave({
                  sound: {
                    ...snd,
                    pressSet: e.target.value as typeof snd.pressSet
                  }
                })
              }
            >
              <option value="duck">小黄鸭 (内置 Ya1 / Ya2)</option>
              <option value="fx1">音效组 1 (内置 D1 / D2)</option>
              <option value="custom">自定义裁剪音效</option>
              <option value="off">静音</option>
            </select>
            <button
              type="button"
              className="wstudio-mini-btn"
              onClick={() => {
                playPressSound({ ...snd, enabled: true })
                window.setTimeout(() => playReleaseSound({ ...snd, enabled: true }), 260)
              }}
            >
              🔊 试听
            </button>
          </div>

          <div className="wstudio-field-row">
            <label style={{ minWidth: 96 }}>
              按压音量 ({Math.round(snd.pressVolume * 100)}%)
            </label>
            <input
              type="range"
              className="wstudio-range"
              min={0}
              max={1}
              step={0.05}
              value={snd.pressVolume}
              onChange={(e) =>
                void onSave({
                  sound: { ...snd, pressVolume: Number(e.target.value) }
                })
              }
            />
          </div>
        </div>

        {/* ② 转换/打包任务完成音 */}
        <div className="wstudio-sound-block">
          <div className="wstudio-field-row">
            <label style={{ minWidth: 96, fontWeight: 700 }}>② 转换完成音</label>
            <select
              className="wstudio-select"
              value={snd.taskEndSound}
              onChange={(e) =>
                void onSave({
                  sound: {
                    ...snd,
                    taskEndSound: e.target.value as typeof snd.taskEndSound
                  }
                })
              }
            >
              <option value="exp_orb">Minecraft · 经验球 (默认)</option>
              <option value="end_a">任务结束音 A</option>
              <option value="custom">自定义裁剪完成音</option>
              <option value="off">静音</option>
            </select>
            <button
              type="button"
              className="wstudio-mini-btn"
              onClick={() => playTaskEndSound({ ...snd, enabled: true })}
            >
              🔊 试听
            </button>
          </div>

          <div className="wstudio-field-row">
            <label style={{ minWidth: 96 }}>
              完成音音量 (
              {Math.round(
                (snd.followPressVolume ? snd.pressVolume : snd.taskEndVolume) * 100
              )}
              %)
            </label>
            <input
              type="range"
              className="wstudio-range"
              min={0}
              max={1}
              step={0.05}
              value={snd.followPressVolume ? snd.pressVolume : snd.taskEndVolume}
              onChange={(e) =>
                void onSave({
                  sound: {
                    ...snd,
                    followPressVolume: false,
                    taskEndVolume: Number(e.target.value)
                  }
                })
              }
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <input
                type="checkbox"
                checked={snd.followPressVolume}
                onChange={(e) =>
                  void onSave({
                    sound: { ...snd, followPressVolume: e.target.checked }
                  })
                }
              />
              跟随按压音量
            </label>
          </div>
        </div>

        {/* ✂️ 音频片段导入与可视化波形裁剪 */}
        <div className="wstudio-audio-cropper">
          <div className="wstudio-rand-head">
            <span>✂️ 导入本地音频并可视化波形裁剪</span>
            <button
              type="button"
              className="wstudio-mini-btn"
              onClick={() => void handleImportAudioForCrop()}
            >
              🎵 导入音频文件 (MP3 / WAV / OGG)
            </button>
          </div>

          {audioBuffer && (
            <div className="wstudio-wave-box">
              <div className="wstudio-subhint">
                已加载：{audioClipName}（总时长 {audioBuffer.duration.toFixed(2)}s · 当前截取{' '}
                {trimStart.toFixed(2)}s ~ {trimEnd.toFixed(2)}s）
              </div>
              <canvas
                ref={waveCanvasRef}
                width={420}
                height={88}
                className="wstudio-wave-canvas"
              />
              <div className="wstudio-field-row">
                <span>起点</span>
                <input
                  type="range"
                  className="wstudio-range"
                  min={0}
                  max={Math.max(0.05, trimEnd - 0.05)}
                  step={0.01}
                  value={trimStart}
                  onChange={(e) => setTrimStart(Number(e.target.value))}
                />
                <span>终点</span>
                <input
                  type="range"
                  className="wstudio-range"
                  min={Math.min(audioBuffer.duration, trimStart + 0.05)}
                  max={audioBuffer.duration}
                  step={0.01}
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(Number(e.target.value))}
                />
              </div>
              <div className="wstudio-field-row" style={{ justifyContent: 'center' }}>
                <button
                  type="button"
                  className="wstudio-mini-btn"
                  onClick={handlePreviewCroppedAudio}
                >
                  ▶ 试听裁剪片段
                </button>
                <button
                  type="button"
                  className="wstudio-primary-btn"
                  onClick={() => void handleApplyCroppedAudio('press')}
                >
                  设为按压音效
                </button>
                <button
                  type="button"
                  className="wstudio-primary-btn"
                  onClick={() => void handleApplyCroppedAudio('release')}
                >
                  设为松开音效
                </button>
                <button
                  type="button"
                  className="wstudio-primary-btn"
                  onClick={() => void handleApplyCroppedAudio('taskEnd')}
                >
                  设为任务完成音
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
