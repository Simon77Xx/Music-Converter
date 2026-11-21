import archiver from 'archiver'
import { createWriteStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { basename, sep } from 'node:path'
import { normalizeForCompare, resolveUniqueOutputPath } from './paths'

export async function zipFolderTo(
  folderPath: string,
  outputDir: string,
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal
): Promise<{ outputPath: string }> {
  if (signal?.aborted) {
    throw new Error('任务已取消')
  }

  // 检查输出目录是否位于待打包文件夹内部（避免把正在生成的 zip 递归打进自身）
  const normFolder = normalizeForCompare(folderPath)
  const normOutDir = normalizeForCompare(outputDir)
  if (normOutDir === normFolder || normOutDir.startsWith(normFolder + sep)) {
    throw new Error('不能直接打包包含输出目录（SoftcreateOutput）的文件夹，以免产生无限递归打包。')
  }

  const name = basename(folderPath) || 'archive'
  const outputPath = resolveUniqueOutputPath(outputDir, name, '.zip')

  return new Promise((resolve, reject) => {
    const out = createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    let settled = false

    const cleanupPartialZip = async () => {
      try {
        await rm(outputPath, { force: true })
      } catch {
        // ignore cleanup error
      }
    }

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      try {
        archive.abort()
      } catch {
        // ignore
      }
      out.destroy()
      void cleanupPartialZip().finally(() => reject(err))
    }

    const onAbort = () => {
      fail(new Error('任务已取消'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })

    archive.on('progress', (p) => {
      if (settled) return
      const total = p.entries.total || 0
      const done = p.entries.processed || 0
      if (total > 0 && onProgress) {
        onProgress(Math.min(0.99, done / total))
      }
    })

    archive.on('warning', (err) => {
      if (err.code !== 'ENOENT') {
        fail(err)
      }
    })

    archive.on('error', (err) => {
      fail(err)
    })

    out.on('error', (err) => {
      fail(err)
    })

    out.on('close', () => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      onProgress?.(1)
      resolve({ outputPath })
    })

    archive.pipe(out)
    archive.directory(folderPath, false)
    onProgress?.(0.05)

    void archive.finalize().catch((err) => {
      fail(err instanceof Error ? err : new Error(String(err)))
    })
  })
}

