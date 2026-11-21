import { useEffect, useMemo, useState } from 'react'
import type { AudioOutputFormat, DropTask } from '../../../shared/types'

const FORMATS: AudioOutputFormat[] = [
  'mp3',
  'm4a',
  'aac',
  'wav',
  'flac',
  'ogg',
  'opus',
  'wma'
]

const BITRATES = [96, 128, 192, 256, 320] as const

type Phase = 'idle' | 'running' | 'done' | 'error'
type AudioUi = 'pick' | 'compress' | 'convert'

export function ProcessApp(): JSX.Element {
  const taskId = useMemo(
    () => new URLSearchParams(window.location.search).get('taskId'),
    []
  )

  const [task, setTask] = useState<DropTask | null>(null)
  const [outputDir, setOutputDir] = useState<string>('')
  const [defaultOutputDir, setDefaultOutputDir] = useState<string>('')
  const [sourceParentDir, setSourceParentDir] = useState<string>('')

  const [audioUi, setAudioUi] = useState<AudioUi>('pick')
  const [format, setFormat] = useState<AudioOutputFormat>('mp3')
  const [bitrate, setBitrate] = useState<number>(128)
  /** 压缩：有损 MP3 / 无损 FLAC */
  const [compressProfile, setCompressProfile] = useState<'lossy' | 'lossless'>('lossy')
  const [flacLevel, setFlacLevel] = useState<number>(8)

  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [donePaths, setDonePaths] = useState<string[]>([])

  useEffect(() => {
    if (!taskId) return
    void window.softcreate.getTask(taskId).then(async (t) => {
      setTask(t)
      if (t && t.paths.length > 0) {
        const parent = await window.softcreate.getParentDir(t.paths[0])
        setSourceParentDir(parent)
      }
    })
    void window.softcreate.getOutputDir().then(setOutputDir)
    void window.softcreate.getDefaultOutputDir().then(setDefaultOutputDir)
  }, [taskId])

  useEffect(() => {
    if (task?.label) {
      document.title = task.label
    }
  }, [task?.label])

  useEffect(() => {
    if (!taskId) return
    return window.softcreate.onJobProgress((payload) => {
      if (payload.taskId !== taskId) return
      setProgress(Math.round(payload.ratio * 100))
    })
  }, [taskId])

  const title = task?.label ?? '…'

  const handlePickOutputDir = async () => {
    const picked = await window.softcreate.pickOutputDir()
    if (picked) {
      setOutputDir(picked)
    }
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
    if (!taskId || !task || task.kind !== 'folder') return
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

  const runTranscode = async (mode: 'convert' | 'compress') => {
    if (!taskId || !task || (task.kind !== 'audio' && task.kind !== 'batch-audio')) return
    setError(null)
    setPhase('running')
    setProgress(0)
    try {
      const out = await window.softcreate.transcode({
        taskId,
        paths: task.paths,
        outputFormat: format,
        mode,
        outputDir,
        bitrateKbps: mode === 'compress' && compressProfile === 'lossy' ? bitrate : undefined,
        compressProfile: mode === 'compress' ? compressProfile : undefined,
        flacCompressionLevel:
          mode === 'compress' && compressProfile === 'lossless' ? flacLevel : undefined
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
    if (!taskId) return
    await window.softcreate.cancelJob(taskId)
  }

  const handleResetToIdle = () => {
    setError(null)
    setProgress(0)
    setPhase('idle')
  }

  if (!taskId) {
    return (
      <div className="proc">
        <p>缺少任务参数。</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="proc">
        <p>加载任务…</p>
      </div>
    )
  }

  const badge =
    task.kind === 'folder'
      ? '检测为：文件夹（将打包为 ZIP）'
      : task.kind === 'unsupported'
        ? '检测为：不支持的类型'
        : '检测为：音频文件'

  const isDefaultDir =
    !defaultOutputDir || outputDir.toLowerCase() === defaultOutputDir.toLowerCase()
  const isSourceDir =
    Boolean(sourceParentDir) &&
    outputDir.toLowerCase() === sourceParentDir.toLowerCase()

  const outputDirBlock = (
    <div className="outdir-section">
      <div className="outdir-header">
        <div className="proc-section-title" style={{ margin: 0 }}>
          输出目录
        </div>
        <div className="outdir-actions">
          <button
            type="button"
            className="outdir-btn outdir-btn-primary"
            onClick={() => void handlePickOutputDir()}
          >
            📁 选择目录…
          </button>
          {sourceParentDir && !isSourceDir && (
            <button
              type="button"
              className="outdir-btn"
              title={`设为：${sourceParentDir}`}
              onClick={() => void handleUseSourceDir()}
            >
              📍 原文件所在目录
            </button>
          )}
          {!isDefaultDir && (
            <button
              type="button"
              className="outdir-btn"
              title={`恢复为默认：${defaultOutputDir}`}
              onClick={() => void handleResetDefaultDir()}
            >
              ↺ 默认目录
            </button>
          )}
          {outputDir && (
            <button
              type="button"
              className="outdir-btn"
              title="在资源管理器中打开此目录"
              onClick={() => void window.softcreate.openPath(outputDir)}
            >
              📂 打开
            </button>
          )}
        </div>
      </div>
      <div className="done-path" style={{ marginTop: 8 }}>
        {outputDir}
      </div>
    </div>
  )

  return (
    <div className="proc">
      <div className="proc-titlebar">{title}</div>
      <div className="proc-badge">{badge}</div>

      {task.proprietary && (
        <div className="warn">
          包含平台专有/加密容器（如 NCM、KGM 等）。FFmpeg 通常无法直接解码；若失败需先转为通用格式或自行处理解密。
        </div>
      )}

      {task.kind === 'unsupported' && (
        <>
          <div className="warn">当前文件扩展名不在支持列表内，请拖入常见音频或文件夹。</div>
          <div className="proc-footer">
            <button type="button" onClick={() => void window.softcreate.closeProcessWindow()}>
              关闭
            </button>
          </div>
        </>
      )}

      {task.kind === 'folder' && phase === 'idle' && (
        <>
          <div className="proc-actions">
            <button type="button" className="btn-pink" onClick={() => void runZip()}>
              压缩（ZIP 归档）
            </button>
          </div>
          {outputDirBlock}
        </>
      )}

      {(task.kind === 'audio' || task.kind === 'batch-audio') && phase === 'idle' && (
        <>
          <div className="proc-actions">
            <button
              type="button"
              className="btn-pink"
              onClick={() => setAudioUi('compress')}
            >
              压缩
            </button>
            <button
              type="button"
              className="btn-blue"
              onClick={() => setAudioUi('convert')}
            >
              转格式
            </button>
          </div>

          {audioUi === 'compress' && (
            <>
              <button
                type="button"
                style={{ marginTop: 8, fontSize: 12, background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
                onClick={() => setAudioUi('pick')}
              >
                ← 返回
              </button>
              <div className="proc-section-title">压缩模式</div>
              <div className="bitrate-row" style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  className={compressProfile === 'lossy' ? 'active' : ''}
                  onClick={() => setCompressProfile('lossy')}
                >
                  有损（MP3）
                </button>
                <button
                  type="button"
                  className={compressProfile === 'lossless' ? 'active' : ''}
                  onClick={() => setCompressProfile('lossless')}
                >
                  无损（FLAC）
                </button>
              </div>
              {compressProfile === 'lossy' && (
                <>
                  <div className="proc-section-title">码率</div>
                  <div className="bitrate-row">
                    {BITRATES.map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={bitrate === b ? 'active' : ''}
                        onClick={() => setBitrate(b)}
                      >
                        {b} kbps
                      </button>
                    ))}
                  </div>
                </>
              )}
              {compressProfile === 'lossless' && (
                <>
                  <div className="proc-section-title">FLAC 压缩等级（0–12，越高文件越小、编码稍慢）</div>
                  <div className="bitrate-row">
                    {[0, 5, 8, 12].map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        className={flacLevel === lv ? 'active' : ''}
                        onClick={() => setFlacLevel(lv)}
                      >
                        {lv}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="proc-footer" style={{ marginTop: 12 }}>
                <button type="button" className="btn-pink" onClick={() => void runTranscode('compress')}>
                  开始压缩
                </button>
              </div>
            </>
          )}

          {audioUi === 'convert' && (
            <>
              <button
                type="button"
                style={{ marginTop: 8, fontSize: 12, background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
                onClick={() => setAudioUi('pick')}
              >
                ← 返回
              </button>
              <div className="proc-section-title">选择输出音频格式</div>
              <div className="format-grid">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={format === f ? 'active' : ''}
                    onClick={() => setFormat(f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="proc-footer" style={{ marginTop: 12 }}>
                <button type="button" className="btn-blue" onClick={() => void runTranscode('convert')}>
                  开始转换
                </button>
              </div>
            </>
          )}

          {outputDirBlock}
        </>
      )}

      {phase === 'running' && (
        <div className="progress-wrap">
          <div className="progress-label">处理中… {progress}%</div>
          <div className="progress-bar">
            <div style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <div className="proc-footer">
            <button type="button" onClick={() => void handleCancelJob()}>
              取消任务
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <>
          {error && <div className="err">{error}</div>}
          <div className="proc-footer">
            <button type="button" onClick={handleResetToIdle}>
              返回重试
            </button>
            <button type="button" onClick={() => void window.softcreate.closeProcessWindow()}>
              关闭窗口
            </button>
          </div>
        </>
      )}

      {phase === 'done' && (
        <>
          <div className="proc-section-title">处理完成</div>
          <div className="done-path">
            已输出到目录：
            <br />
            {outputDir}
            <br />
            <br />
            文件：
            <br />
            {donePaths.join('\n')}
          </div>
          <div className="proc-footer">
            <button
              type="button"
              onClick={() => void window.softcreate.showItemInFolder(donePaths[0])}
            >
              在文件夹中显示
            </button>
            <button type="button" onClick={() => void window.softcreate.closeProcessWindow()}>
              关闭
            </button>
          </div>
        </>
      )}

      {phase === 'idle' && task.kind === 'folder' && (
        <div className="proc-footer">
          <button type="button" onClick={() => void window.softcreate.closeProcessWindow()}>
            关闭
          </button>
        </div>
      )}

      {phase === 'idle' &&
        (task.kind === 'audio' || task.kind === 'batch-audio') &&
        audioUi === 'pick' && (
          <div className="proc-footer">
            <button type="button" onClick={() => void window.softcreate.closeProcessWindow()}>
              关闭
            </button>
          </div>
        )}
    </div>
  )
}

