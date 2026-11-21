import { useCallback, useEffect, useState } from 'react'
import type {
  AudioOutputFormat,
  DropTask,
  PetConfig,
  ProcessTabId
} from '../../../shared/types'
import { SoundAndRoleTab } from './SnapAndSoundTabs'

const FORMATS: { id: AudioOutputFormat; desc: string }[] = [
  { id: 'mp3', desc: '网易云/全平台通用' },
  { id: 'm4a', desc: 'Apple Music 原生' },
  { id: 'flac', desc: '无损音乐导入' },
  { id: 'wav', desc: '未压缩母带' },
  { id: 'aac', desc: '高音质流媒体' },
  { id: 'opus', desc: '高压缩比音频' },
  { id: 'ogg', desc: '开源音频容器' },
  { id: 'wma', desc: 'Windows 传统' }
]

const PLATFORM_PRESETS: {
  id: string
  title: string
  subtitle: string
  format: AudioOutputFormat
  bitrate?: number
}[] = [
  {
    id: 'netease',
    title: '☁️ 导入网易云音乐',
    subtitle: 'MP3 · 320kbps · 保留歌名/歌手 ID3 标签',
    format: 'mp3',
    bitrate: 320
  },
  {
    id: 'apple',
    title: '🍎 导入 Apple Music',
    subtitle: 'M4A (AAC 256k) · iTunes/iPhone 原生兼容',
    format: 'm4a',
    bitrate: 256
  },
  {
    id: 'lossless',
    title: '💎 跨平台无损互导',
    subtitle: 'FLAC 无损 · 网易云云盘 / QQ音乐无损识别',
    format: 'flac'
  },
  {
    id: 'car',
    title: '🚗 车载 / 随身听通用',
    subtitle: 'MP3 · 192kbps · 体积适中全设备秒读',
    format: 'mp3',
    bitrate: 192
  }
]

const BITRATES = [96, 128, 192, 256, 320] as const

type Phase = 'idle' | 'running' | 'done' | 'error'

export function ProcessApp(): JSX.Element {
  const initialParams = new URLSearchParams(window.location.search)
  const rawTab = initialParams.get('tab')
  const [activeTab, setActiveTab] = useState<'converter' | 'sound-role'>(
    rawTab === 'sound-role' ? 'sound-role' : 'converter'
  )
  const [taskId, setTaskId] = useState<string>(initialParams.get('taskId') || 'manual-task')

  const [task, setTask] = useState<DropTask | null>(null)
  const [petConfig, setPetConfig] = useState<PetConfig | null>(null)
  const [outputDir, setOutputDir] = useState<string>('')
  const [defaultOutputDir, setDefaultOutputDir] = useState<string>('')
  const [sourceParentDir, setSourceParentDir] = useState<string>('')

  const [audioMode, setAudioMode] = useState<'convert' | 'compress'>('convert')
  const [selectedPreset, setSelectedPreset] = useState<string>('netease')
  const [format, setFormat] = useState<AudioOutputFormat>('mp3')
  const [bitrate, setBitrate] = useState<number>(320)
  const [compressProfile, setCompressProfile] = useState<'lossy' | 'lossless'>('lossy')
  const [flacLevel, setFlacLevel] = useState<number>(8)

  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [donePaths, setDonePaths] = useState<string[]>([])

  const loadTaskById = useCallback(async (id: string) => {
    const t = await window.softcreate.getTask(id)
    if (t) {
      setTask(t)
      setPhase('idle')
      setError(null)
      if (t.paths.length > 0) {
        const parent = await window.softcreate.getParentDir(t.paths[0])
        setSourceParentDir(parent)
      }
    }
  }, [])

  useEffect(() => {
    void loadTaskById(taskId)
    void window.softcreate.getOutputDir().then(setOutputDir)
    void window.softcreate.getDefaultOutputDir().then(setDefaultOutputDir)
    void window.softcreate.getPetConfig().then(setPetConfig)

    const unsubNav = window.softcreate.onStudioNavigate(
      (payload: { tab: ProcessTabId; taskId?: string | null }) => {
        setActiveTab(payload.tab === 'sound-role' ? 'sound-role' : 'converter')
        if (payload.taskId) {
          setTaskId(payload.taskId)
          void loadTaskById(payload.taskId)
        }
      }
    )

    const unsubCfg = window.softcreate.onPetConfigUpdated((cfg) => {
      setPetConfig(cfg)
    })

    return () => {
      unsubNav()
      unsubCfg()
    }
  }, [loadTaskById, taskId])

  useEffect(() => {
    return window.softcreate.onJobProgress((payload) => {
      setProgress(Math.round(payload.ratio * 100))
    })
  }, [])

  const handleSavePetConfig = async (partial: Partial<PetConfig>) => {
    const saved = await window.softcreate.savePetConfig(partial)
    setPetConfig(saved)
  }

  const handlePickFiles = async (mode: 'audio' | 'folder') => {
    const res = await window.softcreate.pickFilesForStudio(mode)
    if (!res) return
    setTaskId(res.taskId)
    setTask(res.task)
    setPhase('idle')
    setError(null)
    if (res.task.paths.length > 0) {
      const parent = await window.softcreate.getParentDir(res.task.paths[0])
      setSourceParentDir(parent)
    }
  }

  const handleDropInStudio = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length === 0) return
    const paths = files.map((f) => window.softcreate.getPathForFile(f))
    try {
      const analyzed = await window.softcreate.analyzeDrop(paths)
      const newId = await window.softcreate.openTask(analyzed)
      setTaskId(newId)
      setTask(analyzed)
      setPhase('idle')
      setError(null)
      if (analyzed.paths.length > 0) {
        const parent = await window.softcreate.getParentDir(analyzed.paths[0])
        setSourceParentDir(parent)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase('error')
    }
  }

  const handlePickOutputDir = async () => {
    const picked = await window.softcreate.pickOutputDir()
    if (picked) setOutputDir(picked)
  }

  const handleUseSourceDir = async () => {
    if (!sourceParentDir) return
    const saved = await window.softcreate.setOutputDir(sourceParentDir)
    setOutputDir(saved)
  }

  const handleResetDefaultDir = async () => {
    const saved = await window.softcreate.setOutputDir(null)
    setOutputDir(saved)
  }

  const runZip = async () => {
    if (!task || task.kind !== 'folder') return
    setError(null)
    setPhase('running')
    setProgress(0)
    try {
      const { outputPath } = await window.softcreate.zipFolder(
        taskId,
        task.paths[0],
        outputDir
      )
      setDonePaths([outputPath])
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('error')
    }
  }

  const runTranscode = async () => {
    if (!task || (task.kind !== 'audio' && task.kind !== 'batch-audio')) return
    setError(null)
    setPhase('running')
    setProgress(0)
    try {
      const out = await window.softcreate.transcode({
        taskId,
        paths: task.paths,
        outputFormat: format,
        mode: audioMode,
        outputDir,
        bitrateKbps:
          audioMode === 'convert'
            ? bitrate
            : compressProfile === 'lossy'
              ? bitrate
              : undefined,
        compressProfile: audioMode === 'compress' ? compressProfile : undefined,
        flacCompressionLevel:
          audioMode === 'compress' && compressProfile === 'lossless'
            ? flacLevel
            : undefined
      })
      setDonePaths(out.outputPaths)
      setOutputDir(out.outputDir)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('error')
    }
  }

  const handleCancelJob = async () => {
    await window.softcreate.cancelJob(taskId)
  }

  const isDefaultDir =
    !defaultOutputDir || outputDir.toLowerCase() === defaultOutputDir.toLowerCase()
  const isSourceDir =
    Boolean(sourceParentDir) &&
    outputDir.toLowerCase() === sourceParentDir.toLowerCase()

  return (
    <div
      className="wstudio-root"
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onDrop={(e) => void handleDropInStudio(e)}
    >
      {/* 顶部清爽双 Tab 导航栏（仅保留核心转换页 + 形象音效页） */}
      <div className="wstudio-navbar">
        <div className="wstudio-nav-tabs">
          <button
            type="button"
            className={`wstudio-nav-tab ${activeTab === 'converter' ? 'active' : ''}`}
            onClick={() => setActiveTab('converter')}
          >
            🎵 跨平台音乐转换 & 归档
          </button>
          <button
            type="button"
            className={`wstudio-nav-tab ${activeTab === 'sound-role' ? 'active' : ''}`}
            onClick={() => setActiveTab('sound-role')}
          >
            🐳 桌宠形象 & 音效设置
          </button>
        </div>
      </div>

      {/* TAB 1: 跨平台音乐格式转换 & 归档主界面 */}
      {activeTab === 'converter' && (
        <div className="wstudio-panel">
          {/* 文件选择与投喂区 */}
          <div className="wstudio-card wstudio-pick-card">
            <div className="wstudio-card-head">
              <div className="wstudio-card-title">
                {task
                  ? `🎵 已载入：${task.label}`
                  : '🎵 选择或拖入下载的音乐（一键转换导入网易云 / Apple Music）'}
              </div>
              {task && (
                <span className="wstudio-badge">
                  {task.kind === 'folder'
                    ? '文件夹 → ZIP 归档'
                    : task.kind === 'unsupported'
                      ? '不支持的格式'
                      : `共 ${task.paths.length} 首音乐`}
                </span>
              )}
            </div>

            <div className="wstudio-pick-actions">
              <button
                type="button"
                className="wstudio-primary-btn"
                onClick={() => void handlePickFiles('audio')}
              >
                ＋ 选择音乐文件（支持批量多选）…
              </button>
              <button
                type="button"
                className="wstudio-secondary-btn"
                onClick={() => void handlePickFiles('folder')}
              >
                📁 选择文件夹打包 ZIP…
              </button>
              {task && (
                <button
                  type="button"
                  className="wstudio-mini-btn"
                  onClick={() => {
                    setTask(null)
                    setPhase('idle')
                    setError(null)
                  }}
                >
                  清空重选
                </button>
              )}
            </div>

            {task?.proprietary && (
              <div className="wstudio-warn">
                ⚠️ 检测到平台加密容器（如 QMC/MFLAC/NCM/KGM）。FFmpeg 无法直接解码加密流，请先解锁为通用音频或下载非加密格式后再转码导入。
              </div>
            )}
          </div>

          {/* 音频转换与平台适配面板 */}
          {(!task || task.kind === 'audio' || task.kind === 'batch-audio') &&
            phase === 'idle' && (
              <div className="wstudio-card">
                <div className="wstudio-seg-bar">
                  <button
                    type="button"
                    className={`wstudio-seg-btn ${
                      audioMode === 'convert' ? 'active' : ''
                    }`}
                    onClick={() => setAudioMode('convert')}
                  >
                    ⚡ 音乐平台导入 / 转格式
                  </button>
                  <button
                    type="button"
                    className={`wstudio-seg-btn ${
                      audioMode === 'compress' ? 'active' : ''
                    }`}
                    onClick={() => setAudioMode('compress')}
                  >
                    📦 音频体积瘦身压缩
                  </button>
                </div>

                {audioMode === 'convert' ? (
                  <>
                    {/* 目标音乐平台一键适配预设 */}
                    <div className="wstudio-sec-label">
                      🎯 目标平台一键适配（自动保留歌名 / 歌手 / 专辑标签）
                    </div>
                    <div className="wstudio-preset-grid">
                      {PLATFORM_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`wstudio-preset-card ${
                            selectedPreset === p.id && format === p.format ? 'active' : ''
                          }`}
                          onClick={() => {
                            setSelectedPreset(p.id)
                            setFormat(p.format)
                            if (p.bitrate) setBitrate(p.bitrate)
                          }}
                        >
                          <div className="wstudio-preset-title">{p.title}</div>
                          <div className="wstudio-preset-sub">{p.subtitle}</div>
                        </button>
                      ))}
                    </div>

                    <div className="wstudio-sec-label" style={{ marginTop: 12 }}>
                      或自由选择目标音频编码格式
                    </div>
                    <div className="wstudio-format-grid">
                      {FORMATS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className={`wstudio-fmt-card ${
                            format === f.id ? 'active' : ''
                          }`}
                          onClick={() => {
                            setSelectedPreset('custom')
                            setFormat(f.id)
                          }}
                        >
                          <span className="wstudio-fmt-name">
                            {f.id.toUpperCase()}
                          </span>
                          <span className="wstudio-fmt-desc">{f.desc}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="wstudio-sec-label">选择压缩方案</div>
                    <div className="wstudio-chip-row">
                      <button
                        type="button"
                        className={`wstudio-chip ${
                          compressProfile === 'lossy' ? 'active' : ''
                        }`}
                        onClick={() => setCompressProfile('lossy')}
                      >
                        有损高兼容瘦身（MP3 编码）
                      </button>
                      <button
                        type="button"
                        className={`wstudio-chip ${
                          compressProfile === 'lossless' ? 'active' : ''
                        }`}
                        onClick={() => setCompressProfile('lossless')}
                      >
                        无损体积优化（FLAC 编码）
                      </button>
                    </div>

                    {compressProfile === 'lossy' ? (
                      <>
                        <div className="wstudio-sec-label">目标码率（越小体积越小）</div>
                        <div className="wstudio-chip-row">
                          {BITRATES.map((b) => (
                            <button
                              key={b}
                              type="button"
                              className={`wstudio-chip ${
                                bitrate === b ? 'active' : ''
                              }`}
                              onClick={() => setBitrate(b)}
                            >
                              {b} kbps
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="wstudio-sec-label">
                          FLAC 无损压缩等级（0–12，越高体积越小）
                        </div>
                        <div className="wstudio-chip-row">
                          {[0, 5, 8, 12].map((lv) => (
                            <button
                              key={lv}
                              type="button"
                              className={`wstudio-chip ${
                                flacLevel === lv ? 'active' : ''
                              }`}
                              onClick={() => setFlacLevel(lv)}
                            >
                              等级 {lv}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

          {/* 输出目录自由选择卡片 */}
          <div className="wstudio-card">
            <div className="wstudio-card-head">
              <div className="wstudio-card-title">📂 输出位置（自由选择并自动记忆）</div>
              <div className="wstudio-add-bar">
                <button
                  type="button"
                  className="wstudio-mini-btn active"
                  onClick={() => void handlePickOutputDir()}
                >
                  📁 选择目录…
                </button>
                {sourceParentDir && !isSourceDir && (
                  <button
                    type="button"
                    className="wstudio-mini-btn"
                    title={`设为：${sourceParentDir}`}
                    onClick={() => void handleUseSourceDir()}
                  >
                    📍 原文件目录
                  </button>
                )}
                {!isDefaultDir && (
                  <button
                    type="button"
                    className="wstudio-mini-btn"
                    onClick={() => void handleResetDefaultDir()}
                  >
                    ↺ 默认目录
                  </button>
                )}
                {outputDir && (
                  <button
                    type="button"
                    className="wstudio-mini-btn"
                    onClick={() => void window.softcreate.openPath(outputDir)}
                  >
                    ↗ 打开
                  </button>
                )}
              </div>
            </div>
            <div className="wstudio-path-box">{outputDir}</div>
          </div>

          {/* 底部执行按钮 / 进度条 / 完成结果 */}
          {phase === 'idle' && (
            <div className="wstudio-cta-bar">
              {task?.kind === 'folder' ? (
                <button
                  type="button"
                  className="wstudio-cta-btn"
                  onClick={() => void runZip()}
                >
                  ▶ 开始打包为 ZIP 归档（{task.label}）
                </button>
              ) : (
                <button
                  type="button"
                  className="wstudio-cta-btn"
                  disabled={!task || task.kind === 'unsupported'}
                  onClick={() => void runTranscode()}
                >
                  {task
                    ? `▶ 开始${audioMode === 'convert' ? `转换为 ${format.toUpperCase()}` : '压缩音频'}（共 ${task.paths.length} 首）`
                    : '请先在上方点击「＋ 选择音乐文件」或将音乐拖入窗口'}
                </button>
              )}
            </div>
          )}

          {phase === 'running' && (
            <div className="wstudio-card">
              <div className="wstudio-card-head">
                <span className="wstudio-card-title">⏳ 正在高速转换中… {progress}%</span>
                <button
                  type="button"
                  className="wstudio-mini-btn danger"
                  onClick={() => void handleCancelJob()}
                >
                  取消任务
                </button>
              </div>
              <div className="wstudio-progress-track">
                <div
                  className="wstudio-progress-fill"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="wstudio-card">
              <div className="wstudio-err">{error}</div>
              <div className="wstudio-pick-actions" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="wstudio-primary-btn"
                  onClick={() => {
                    setError(null)
                    setPhase('idle')
                  }}
                >
                  返回重试
                </button>
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="wstudio-card">
              <div className="wstudio-card-title">
                ✅ 转换完成！现在可以直接导入网易云音乐 / Apple Music 了
              </div>
              <div className="wstudio-path-box" style={{ marginTop: 8 }}>
                {donePaths.join('\n')}
              </div>
              <div className="wstudio-pick-actions" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="wstudio-primary-btn"
                  onClick={() => void window.softcreate.showItemInFolder(donePaths[0])}
                >
                  📂 在文件夹中显示（直接拖进音乐软件）
                </button>
                <button
                  type="button"
                  className="wstudio-secondary-btn"
                  onClick={() => setPhase('idle')}
                >
                  继续转换其他音乐
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 桌宠形象 & 音效设置 */}
      {activeTab === 'sound-role' && petConfig && (
        <SoundAndRoleTab config={petConfig} onSave={handleSavePetConfig} />
      )}
    </div>
  )
}
