import { app, BrowserWindow, dialog } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

/** 跨平台：用户主目录下的默认输出子目录 */
export const OUTPUT_DIR_NAME = 'SoftcreateOutput'

let cachedCustomOutputDir: string | null | undefined = undefined

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'path-settings.json')
}

function loadSavedOutputDir(): string | null {
  if (cachedCustomOutputDir !== undefined) {
    return cachedCustomOutputDir
  }
  try {
    const p = getSettingsPath()
    if (existsSync(p)) {
      const data = JSON.parse(readFileSync(p, 'utf-8')) as { outputDir?: string }
      if (data.outputDir && typeof data.outputDir === 'string') {
        cachedCustomOutputDir = data.outputDir
        return cachedCustomOutputDir
      }
    }
  } catch {
    // ignore read error
  }
  cachedCustomOutputDir = null
  return null
}

function saveCustomOutputDirToDisk(dir: string | null): void {
  cachedCustomOutputDir = dir
  try {
    const p = getSettingsPath()
    writeFileSync(p, JSON.stringify({ outputDir: dir }, null, 2), 'utf-8')
  } catch {
    // ignore write error
  }
}

export function getDefaultOutputDir(): string {
  return join(homedir(), OUTPUT_DIR_NAME)
}

export function getOutputDir(): string {
  const custom = loadSavedOutputDir()
  return custom || getDefaultOutputDir()
}

export async function setOutputDir(dir: string | null): Promise<string> {
  if (!dir) {
    saveCustomOutputDirToDisk(null)
    return ensureOutputDir()
  }
  const target = resolve(dir)
  await mkdir(target, { recursive: true })
  saveCustomOutputDirToDisk(target)
  return target
}

export async function pickOutputDirDialog(parentWin?: BrowserWindow | null): Promise<string | null> {
  const current = getOutputDir()
  const opts: Electron.OpenDialogOptions = {
    title: '选择转换/压缩文件的输出目录',
    defaultPath: existsSync(current) ? current : homedir(),
    properties: ['openDirectory', 'createDirectory']
  }
  const res = parentWin
    ? await dialog.showOpenDialog(parentWin, opts)
    : await dialog.showOpenDialog(opts)

  if (res.canceled || res.filePaths.length === 0) {
    return null
  }
  return setOutputDir(res.filePaths[0])
}

export function getParentDirOfPath(filePath: string): string {
  return dirname(resolve(filePath))
}

export async function ensureOutputDir(targetDir?: string): Promise<string> {
  const dir = targetDir ? resolve(targetDir) : getOutputDir()
  await mkdir(dir, { recursive: true })
  return dir
}

/**
 * 归一化路径用于比较（Windows 下忽略大小写）
 */
export function normalizeForCompare(p: string): string {
  const r = resolve(p)
  return process.platform === 'win32' ? r.toLowerCase() : r
}

/**
 * 生成不与已有文件、同一批次已占用路径或源文件冲突的唯一输出路径
 * 例如：song.mp3 -> song (1).mp3 -> song (2).mp3
 */
export function resolveUniqueOutputPath(
  outputDir: string,
  baseName: string,
  extWithDot: string,
  options?: {
    avoidPaths?: Iterable<string>
  }
): string {
  const avoidSet = new Set<string>()
  if (options?.avoidPaths) {
    for (const p of options.avoidPaths) {
      avoidSet.add(normalizeForCompare(p))
    }
  }

  const ext = extWithDot.startsWith('.') ? extWithDot : `.${extWithDot}`
  let index = 0

  while (true) {
    const suffix = index === 0 ? '' : ` (${index})`
    const candidate = join(outputDir, `${baseName}${suffix}${ext}`)
    const norm = normalizeForCompare(candidate)
    if (!existsSync(candidate) && !avoidSet.has(norm)) {
      return candidate
    }
    index++
  }
}

