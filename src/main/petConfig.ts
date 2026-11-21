import { app, BrowserWindow, dialog } from 'electron'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { PetConfig } from '../shared/types'

export const DEFAULT_PET_CONFIG: PetConfig = {
  name: '音律喵',
  presetId: 'cat',
  shapeMode: 'full',
  animation: 'float',
  scale: 1,
  greeting: '将音乐文件或文件夹拖给我吧 ~',
  hideFrame: false,
  theme: 'blue'
}

interface StoredPetConfig extends Omit<PetConfig, 'customImageDataUrl'> {
  customImageFileName?: string
}

function getUserConfigDir(): string {
  return join(app.getPath('userData'), 'pet-custom')
}

function getConfigJsonPath(): string {
  return join(getUserConfigDir(), 'pet-config.json')
}

function getMimeByExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    case '.avif':
      return 'image/avif'
    case '.bmp':
      return 'image/bmp'
    default:
      return 'image/png'
  }
}

async function fileToDataUrl(filePath: string): Promise<string | undefined> {
  try {
    if (!existsSync(filePath)) return undefined
    const buf = await readFile(filePath)
    const mime = getMimeByExt(extname(filePath))
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return undefined
  }
}

export async function loadPetConfig(): Promise<PetConfig> {
  const dir = getUserConfigDir()
  const jsonPath = getConfigJsonPath()

  try {
    if (!existsSync(jsonPath)) {
      return { ...DEFAULT_PET_CONFIG }
    }
    const raw = await readFile(jsonPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<StoredPetConfig>
    let customImageDataUrl: string | undefined

    if (parsed.customImageFileName) {
      const imgPath = join(dir, parsed.customImageFileName)
      customImageDataUrl = await fileToDataUrl(imgPath)
    }

    return {
      ...DEFAULT_PET_CONFIG,
      ...parsed,
      customImageDataUrl
    }
  } catch {
    return { ...DEFAULT_PET_CONFIG }
  }
}

export async function savePetConfig(partial: Partial<PetConfig>): Promise<PetConfig> {
  const dir = getUserConfigDir()
  await mkdir(dir, { recursive: true })
  const jsonPath = getConfigJsonPath()

  let existing: Partial<StoredPetConfig> = {}
  try {
    if (existsSync(jsonPath)) {
      existing = JSON.parse(await readFile(jsonPath, 'utf-8')) as Partial<StoredPetConfig>
    }
  } catch {
    existing = {}
  }

  const merged: StoredPetConfig = {
    ...DEFAULT_PET_CONFIG,
    ...existing,
    ...partial,
    customImageFileName: existing.customImageFileName
  }

  // 不把巨大的 base64 写进 JSON，图片单独存文件
  delete (merged as Partial<PetConfig>).customImageDataUrl

  await writeFile(jsonPath, JSON.stringify(merged, null, 2), 'utf-8')
  return loadPetConfig()
}

export async function pickAndSavePetImage(parentWin?: BrowserWindow | null): Promise<PetConfig | null> {
  const res = parentWin
    ? await dialog.showOpenDialog(parentWin, {
        title: '选择你的专属桌宠照片 / 动图 / 立绘',
        properties: ['openFile'],
        filters: [
          {
            name: '图片 / 动图',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp']
          }
        ]
      })
    : await dialog.showOpenDialog({
        title: '选择你的专属桌宠照片 / 动图 / 立绘',
        properties: ['openFile'],
        filters: [
          {
            name: '图片 / 动图',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp']
          }
        ]
      })

  if (res.canceled || res.filePaths.length === 0) {
    return null
  }

  return importPetImageFromPath(res.filePaths[0])
}

export async function importPetImageFromPath(sourcePath: string): Promise<PetConfig> {
  const dir = getUserConfigDir()
  await mkdir(dir, { recursive: true })

  const ext = extname(sourcePath).toLowerCase() || '.png'
  const fileName = `custom-avatar${ext}`
  const destPath = join(dir, fileName)

  await copyFile(sourcePath, destPath)

  const jsonPath = getConfigJsonPath()
  let existing: Partial<StoredPetConfig> = {}
  try {
    if (existsSync(jsonPath)) {
      existing = JSON.parse(await readFile(jsonPath, 'utf-8')) as Partial<StoredPetConfig>
    }
  } catch {
    existing = {}
  }

  const merged: StoredPetConfig = {
    ...DEFAULT_PET_CONFIG,
    ...existing,
    presetId: 'custom',
    customImageFileName: fileName
  }
  delete (merged as Partial<PetConfig>).customImageDataUrl

  await writeFile(jsonPath, JSON.stringify(merged, null, 2), 'utf-8')
  return loadPetConfig()
}
