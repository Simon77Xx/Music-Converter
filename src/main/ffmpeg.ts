import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import type { AudioOutputFormat } from '../shared/types'
import { resolveUniqueOutputPath } from './paths'

export type { AudioOutputFormat }

export interface TranscodeOptions {
  inputPath: string
  outputDir: string
  outputFormat: AudioOutputFormat
  /** 预先分配好的唯一输出路径（可选；不传则自动防冲突生成） */
  outputPath?: string
  /** 有损压缩目标码率 (kbps)，仅对 mp3/aac/m4a/ogg 等有意义 */
  audioBitrateKbps?: number
  /** FLAC 编码压缩等级 0–12，仅对 flac 输出有意义（无损体积优化） */
  flacCompressionLevel?: number
  /** 任务取消信号 */
  signal?: AbortSignal
}

/**
 * 解析打包环境（app.asar -> app.asar.unpacked）下的 ffmpeg 可执行文件路径
 */
export function resolveFfmpegBinary(): string | null {
  if (!ffmpegPath) return null
  return ffmpegPath.replace('app.asar', 'app.asar.unpacked')
}

export function buildOutputPath(
  inputPath: string,
  outputDir: string,
  format: AudioOutputFormat,
  avoidPaths?: Iterable<string>
): string {
  const base = basename(inputPath, extname(inputPath))
  const avoid = new Set<string>(avoidPaths ?? [])
  avoid.add(inputPath)
  return resolveUniqueOutputPath(outputDir, base, `.${format}`, { avoidPaths: avoid })
}

function buildFfmpegArgs(opts: TranscodeOptions, outputPath: string): string[] {
  // -y 允许写入唯一目标路径；-vn 禁用视频流；-map_metadata 0 完整保留歌名/歌手/专辑等元数据供网易云/Apple Music 识别
  const args = ['-y', '-i', opts.inputPath, '-vn', '-map_metadata', '0']

  switch (opts.outputFormat) {
    case 'mp3':
      args.push('-c:a', 'libmp3lame', '-id3v2_version', '3')
      if (opts.audioBitrateKbps) {
        args.push('-b:a', `${opts.audioBitrateKbps}k`)
      } else {
        args.push('-b:a', '320k')
      }
      break
    case 'm4a':
      args.push('-c:a', 'aac', '-movflags', '+faststart')
      if (opts.audioBitrateKbps) {
        args.push('-b:a', `${opts.audioBitrateKbps}k`)
      } else {
        args.push('-b:a', '256k')
      }
      break
    case 'aac':
      args.push('-c:a', 'aac')
      if (opts.audioBitrateKbps) {
        args.push('-b:a', `${opts.audioBitrateKbps}k`)
      } else {
        args.push('-b:a', '256k')
      }
      break
    case 'wav':
      args.push('-c:a', 'pcm_s16le')
      break
    case 'flac':
      args.push('-c:a', 'flac')
      if (opts.flacCompressionLevel !== undefined) {
        const lv = Math.min(12, Math.max(0, Math.round(opts.flacCompressionLevel)))
        args.push('-compression_level', String(lv))
      }
      break
    case 'ogg':
      args.push('-c:a', 'libvorbis')
      if (opts.audioBitrateKbps) {
        args.push('-b:a', `${opts.audioBitrateKbps}k`)
      }
      break
    case 'opus':
      args.push('-c:a', 'libopus')
      if (opts.audioBitrateKbps) {
        args.push('-b:a', `${opts.audioBitrateKbps}k`)
      } else {
        args.push('-b:a', '128k')
      }
      break
    case 'wma':
      args.push('-c:a', 'wmav2', '-f', 'asf')
      if (opts.audioBitrateKbps) {
        args.push('-b:a', `${opts.audioBitrateKbps}k`)
      } else {
        args.push('-b:a', '128k')
      }
      break
    default:
      args.push('-c:a', 'copy')
  }

  args.push(outputPath)
  return args
}

const MAX_STDERR_KEEP = 4000

/** 从 stderr 解析进度，支持跨 chunk 边界匹配并支持 AbortSignal 取消与残留清理 */
export function runFfmpeg(
  opts: TranscodeOptions,
  onProgress?: (ratio: number) => void
): Promise<{ outputPath: string }> {
  const ff = resolveFfmpegBinary()
  if (!ff) {
    return Promise.reject(new Error('未找到 ffmpeg 可执行文件（ffmpeg-static）'))
  }

  if (opts.signal?.aborted) {
    return Promise.reject(new Error('任务已取消'))
  }

  const outputPath =
    opts.outputPath ?? buildOutputPath(opts.inputPath, opts.outputDir, opts.outputFormat)
  const args = buildFfmpegArgs(opts, outputPath)

  return new Promise((resolve, reject) => {
    const proc = spawn(ff, args, { windowsHide: true })
    let durationSec = 0
    let stderrTail = ''
    let carryBuffer = ''
    let settled = false

    const cleanupPartialFile = async () => {
      try {
        await rm(outputPath, { force: true })
      } catch {
        // ignore cleanup error
      }
    }

    const onAbort = () => {
      if (settled) return
      settled = true
      try {
        proc.kill('SIGKILL')
      } catch {
        // ignore kill error
      }
      void cleanupPartialFile().finally(() => {
        reject(new Error('任务已取消'))
      })
    }

    opts.signal?.addEventListener('abort', onAbort, { once: true })

    proc.stderr?.on('data', (chunk: Buffer) => {
      const s = chunk.toString()
      stderrTail = (stderrTail + s).slice(-MAX_STDERR_KEEP)

      // 保留上一次末尾 64 字符拼接，防止 Duration 或 time= 跨 chunk 断裂
      const combined = carryBuffer + s
      carryBuffer = s.slice(-64)

      if (durationSec === 0) {
        const durMatch = combined.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
        if (durMatch) {
          const h = Number(durMatch[1])
          const m = Number(durMatch[2])
          const sec = Number(durMatch[3])
          durationSec = h * 3600 + m * 60 + sec
        }
      }

      if (durationSec > 0 && onProgress) {
        const timeMatches = [...combined.matchAll(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/g)]
        if (timeMatches.length > 0) {
          const lastMatch = timeMatches[timeMatches.length - 1]
          const h = Number(lastMatch[1])
          const m = Number(lastMatch[2])
          const sec = Number(lastMatch[3])
          const cur = h * 3600 + m * 60 + sec
          onProgress(Math.min(0.99, Math.max(0, cur / durationSec)))
        }
      }
    })

    proc.on('error', (err) => {
      if (settled) return
      settled = true
      opts.signal?.removeEventListener('abort', onAbort)
      void cleanupPartialFile().finally(() => reject(err))
    })

    proc.on('close', (code) => {
      if (settled) return
      settled = true
      opts.signal?.removeEventListener('abort', onAbort)

      if (code === 0) {
        onProgress?.(1)
        resolve({ outputPath })
      } else {
        void cleanupPartialFile().finally(() => {
          reject(new Error(`ffmpeg 退出码 ${code}\n${stderrTail.slice(-2000)}`))
        })
      }
    })
  })
}

export function buildOutputPathFor(
  inputPath: string,
  outputDir: string,
  format: AudioOutputFormat
): string {
  return buildOutputPath(inputPath, outputDir, format)
}

