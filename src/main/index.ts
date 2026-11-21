import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  ensureOutputDir,
  getDefaultOutputDir,
  getOutputDir,
  getParentDirOfPath,
  pickOutputDirDialog,
  setOutputDir
} from './paths'
import { analyzePaths } from './analyze'
import { buildOutputPath, runFfmpeg } from './ffmpeg'
import type { AudioOutputFormat, DropTask, JobProgressPayload, PetConfig } from '../shared/types'
import { zipFolderTo } from './zipFolder'
import {
  importPetImageFromPath,
  loadPetConfig,
  pickAndSavePetImage,
  savePetConfig
} from './petConfig'

const __dirname = dirname(fileURLToPath(import.meta.url))

const isDev = process.env.NODE_ENV === 'development' || !!process.env['ELECTRON_RENDERER_URL']

const taskStore = new Map<string, DropTask>()
const jobAbortControllers = new Map<string, AbortController>()

let petWindow: BrowserWindow | null = null
let processWindow: BrowserWindow | null = null
let activeProcessTaskId: string | null = null

function getPreloadPath(): string {
  return join(__dirname, '../preload/index.mjs')
}

function abortTaskJob(taskId: string): void {
  const controller = jobAbortControllers.get(taskId)
  if (controller) {
    controller.abort()
    jobAbortControllers.delete(taskId)
  }
}

function sendJobProgress(taskId: string, ratio: number): void {
  if (!processWindow || processWindow.isDestroyed()) return
  if (activeProcessTaskId !== taskId) return
  const payload: JobProgressPayload = { taskId, ratio }
  processWindow.webContents.send('job:progress', payload)
}

function createPetWindow(): void {
  petWindow = new BrowserWindow({
    width: 420,
    height: 580,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    petWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/pet.html`)
  } else {
    petWindow.loadFile(join(__dirname, '../renderer/pet.html'))
  }

  petWindow.once('ready-to-show', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.show()
      petWindow.focus()
    }
  })

  petWindow.on('closed', () => {
    petWindow = null
  })
}

function createProcessWindow(taskId: string): void {
  if (processWindow && !processWindow.isDestroyed()) {
    if (activeProcessTaskId) {
      abortTaskJob(activeProcessTaskId)
      taskStore.delete(activeProcessTaskId)
    }
    processWindow.close()
  }

  activeProcessTaskId = taskId

  const win = new BrowserWindow({
    width: 520,
    height: 640,
    minWidth: 480,
    minHeight: 520,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  processWindow = win

  const q = `taskId=${encodeURIComponent(taskId)}`

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/process.html?${q}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/process.html'), {
      query: { taskId }
    })
  }

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show()
    }
  })

  win.on('closed', () => {
    abortTaskJob(taskId)
    taskStore.delete(taskId)
    if (processWindow === win) {
      processWindow = null
      activeProcessTaskId = null
    }
  })
}

function registerIpc(): void {
  ipcMain.handle('drop:analyze', async (_, paths: string[]) => {
    return analyzePaths(paths)
  })

  ipcMain.handle('task:open', async (_, task: DropTask) => {
    const id = randomUUID()
    taskStore.set(id, task)
    createProcessWindow(id)
    return id
  })

  ipcMain.handle('task:get', async (_, taskId: string) => {
    return taskStore.get(taskId) ?? null
  })

  ipcMain.handle('paths:output-dir', async () => getOutputDir())

  ipcMain.handle('paths:default-output-dir', async () => getDefaultOutputDir())

  ipcMain.handle('paths:pick-output-dir', async () => {
    return pickOutputDirDialog(processWindow ?? petWindow)
  })

  ipcMain.handle('paths:set-output-dir', async (_, dir: string | null) => {
    return setOutputDir(dir)
  })

  ipcMain.handle('paths:parent-dir', async (_, filePath: string) => {
    return getParentDirOfPath(filePath)
  })

  ipcMain.handle('shell:open-path', async (_, p: string) => {
    await shell.openPath(p)
  })

  ipcMain.handle('shell:show-item', async (_, p: string) => {
    shell.showItemInFolder(p)
  })

  ipcMain.handle('job:cancel', async (_, taskId: string) => {
    abortTaskJob(taskId)
  })

  ipcMain.handle(
    'job:zip-folder',
    async (_, payload: { taskId: string; folderPath: string; outputDir?: string }) => {
      const outDir = await ensureOutputDir(payload.outputDir)

      abortTaskJob(payload.taskId)
      const controller = new AbortController()
      jobAbortControllers.set(payload.taskId, controller)

      try {
        const result = await zipFolderTo(
          payload.folderPath,
          outDir,
          (r) => {
            sendJobProgress(payload.taskId, r)
          },
          controller.signal
        )
        return result
      } finally {
        if (jobAbortControllers.get(payload.taskId) === controller) {
          jobAbortControllers.delete(payload.taskId)
        }
      }
    }
  )

  ipcMain.handle(
    'job:transcode',
    async (
      _,
      payload: {
        taskId: string
        paths: string[]
        outputFormat: AudioOutputFormat
        mode: 'convert' | 'compress'
        outputDir?: string
        bitrateKbps?: number
        /** 压缩子模式：有损 → MP3；无损 → FLAC（与 outputFormat 在 compress 模式下由服务端决定） */
        compressProfile?: 'lossy' | 'lossless'
        /** 无损压缩时 FLAC 等级 0–12，默认 8 */
        flacCompressionLevel?: number
      }
    ) => {
      const outDir = await ensureOutputDir(payload.outputDir)
      const outputs: string[] = []
      const total = payload.paths.length

      abortTaskJob(payload.taskId)
      const controller = new AbortController()
      jobAbortControllers.set(payload.taskId, controller)

      const resolveCompress = (): {
        format: AudioOutputFormat
        bitrate?: number
        flacLevel?: number
      } => {
        if (payload.mode !== 'compress') {
          return { format: payload.outputFormat, bitrate: payload.bitrateKbps }
        }
        if (payload.compressProfile === 'lossless') {
          return {
            format: 'flac',
            flacLevel: payload.flacCompressionLevel ?? 8
          }
        }
        return {
          format: 'mp3',
          bitrate: payload.bitrateKbps ?? 128
        }
      }

      const resolved = resolveCompress()
      const allocatedOutputs = new Set<string>(payload.paths)

      try {
        for (let i = 0; i < payload.paths.length; i++) {
          if (controller.signal.aborted) {
            throw new Error('任务已取消')
          }
          const inputPath = payload.paths[i]
          const targetOut = buildOutputPath(
            inputPath,
            outDir,
            resolved.format,
            allocatedOutputs
          )
          allocatedOutputs.add(targetOut)

          const baseProgress = i / total
          const { outputPath } = await runFfmpeg(
            {
              inputPath,
              outputDir: outDir,
              outputFormat: resolved.format,
              outputPath: targetOut,
              audioBitrateKbps: resolved.bitrate,
              flacCompressionLevel: resolved.flacLevel,
              signal: controller.signal
            },
            (ratio) => {
              const p = baseProgress + (ratio / total) * 0.999
              sendJobProgress(payload.taskId, p)
            }
          )
          outputs.push(outputPath)
        }

        sendJobProgress(payload.taskId, 1)
        return { outputPaths: outputs, outputDir: outDir }
      } finally {
        if (jobAbortControllers.get(payload.taskId) === controller) {
          jobAbortControllers.delete(payload.taskId)
        }
      }
    }
  )

  ipcMain.handle('window:close-process', async () => {
    if (processWindow && !processWindow.isDestroyed()) {
      processWindow.close()
    }
  })

  ipcMain.handle('app:quit', async () => {
    for (const id of jobAbortControllers.keys()) {
      abortTaskJob(id)
    }
    app.quit()
  })

  ipcMain.handle('pet:set-ignore-mouse', async (_, ignore: boolean) => {
    if (!petWindow || petWindow.isDestroyed()) return
    if (ignore) {
      petWindow.setIgnoreMouseEvents(true, { forward: true })
    } else {
      petWindow.setIgnoreMouseEvents(false)
    }
  })

  ipcMain.handle('pet:get-config', async () => {
    return loadPetConfig()
  })

  ipcMain.handle('pet:save-config', async (_, partial: Partial<PetConfig>) => {
    return savePetConfig(partial)
  })

  ipcMain.handle('pet:pick-image', async () => {
    return pickAndSavePetImage(petWindow)
  })

  ipcMain.handle('pet:import-image', async (_, sourcePath: string) => {
    return importPetImageFromPath(sourcePath)
  })
}

app.whenReady().then(async () => {
  await ensureOutputDir()
  registerIpc()
  createPetWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow()
    }
  })
})

app.on('before-quit', () => {
  for (const id of jobAbortControllers.keys()) {
    abortTaskJob(id)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

