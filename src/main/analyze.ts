import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { DropTask } from '../shared/types'

/** FFmpeg 常见可直接解码的扩展（含各大音乐平台常见的无损/有损与音视频容器） */
export const COMMON_AUDIO_EXT = new Set([
  'mp3',
  'flac',
  'wav',
  'aac',
  'm4a',
  'ogg',
  'oga',
  'opus',
  'wma',
  'ape',
  'aiff',
  'aif',
  'webm',
  'mp4',
  'm4v',
  'mkv'
])

/** 已知专有/加密容器：需额外解密步骤，FFmpeg 通常无法直接解码 */
export const PROPRIETARY_EXT = new Set([
  'ncm',
  'kgm',
  'kgma',
  'kwm',
  'tkm',
  'qmc',
  'qmc3',
  'mflac',
  'mgg',
  'mggl'
])

export async function analyzePaths(paths: string[]): Promise<DropTask> {
  const normalized = [...new Set(paths.filter(Boolean))]
  if (normalized.length === 0) {
    throw new Error('没有可用的文件路径')
  }

  if (normalized.length === 1) {
    const p = normalized[0]
    const st = await stat(p)
    if (st.isDirectory()) {
      return {
        kind: 'folder',
        paths: [p],
        label: basename(p)
      }
    }
    const ext = extname(p).slice(1).toLowerCase()
    if (PROPRIETARY_EXT.has(ext)) {
      return {
        kind: 'audio',
        paths: [p],
        label: basename(p),
        proprietary: true
      }
    }
    if (COMMON_AUDIO_EXT.has(ext)) {
      return {
        kind: 'audio',
        paths: [p],
        label: basename(p)
      }
    }
    return {
      kind: 'unsupported',
      paths: [p],
      label: basename(p)
    }
  }

  const stats = await Promise.all(
    normalized.map(async (p) => ({ p, st: await stat(p), ext: extname(p).slice(1).toLowerCase() }))
  )

  if (stats.some((s) => s.st.isDirectory())) {
    throw new Error('一次请只拖入多个文件，或单个文件夹，不要混合文件夹与文件')
  }

  const allAudio = stats.every(
    (s) => COMMON_AUDIO_EXT.has(s.ext) || PROPRIETARY_EXT.has(s.ext)
  )
  if (!allAudio) {
    return {
      kind: 'unsupported',
      paths: normalized,
      label: `${normalized.length} 个文件`
    }
  }

  return {
    kind: 'batch-audio',
    paths: normalized,
    label: `${normalized.length} 个音频`,
    proprietary: stats.some((s) => PROPRIETARY_EXT.has(s.ext))
  }
}
