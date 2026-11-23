import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell, type MenuItemConstructorOptions } from 'electron'
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
import { analyzePaths, COMMON_AUDIO_EXT, PROPRIETARY_EXT } from './analyze'
import { buildOutputPath, runFfmpeg } from './ffmpeg'
import type {
  AudioOutputFormat,
  DropTask,
  JobProgressPayload,
  PetConfig,
  ProcessTabId
} from '../shared/types'
import { zipFolderTo } from './zipFolder'
import {
  importPetImageFromPath,
  loadPetConfig,
  pickAudioFileAsDataUrl,
  pickImageFileAsDataUrl,
  savePetConfig
} from './petConfig'

const __dirname = dirname(fileURLToPath(import.meta.url))

const isDev = process.env.NODE_ENV === 'development' || !!process.env['ELECTRON_RENDERER_URL']

const BASE_WIDGET_PX = 180

const taskStore = new Map<string, DropTask>()
const jobAbortControllers = new Map<string, AbortController>()

let petWindow: BrowserWindow | null = null
let processWindow: BrowserWindow | null = null
let activeProcessTaskId: string | null = null
let currentStudioTab: ProcessTabId = 'converter'

// 拖拽状态记录
let dragStartCursor: { x: number; y: number } | null = null
let dragStartBounds: Electron.Rectangle | null = null

function getPreloadPath(): string {
  return join(__dirname, '../preload/index.mjs')
}

function getAppIconPath(): string {
  return isDev
    ? join(process.cwd(), 'public/icon.png')
    : join(__dirname, '../renderer/icon.png')
}

function getWidgetSizePx(scale: number): number {
  const s = Math.min(2.5, Math.max(0.6, Number(scale) || 1))
  return Math.round(BASE_WIDGET_PX * s)
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

function broadcastPetConfig(cfg: PetConfig): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:config-updated', cfg)
  }
  if (processWindow && !processWindow.isDestroyed()) {
    processWindow.webContents.send('pet:config-updated', cfg)
  }
}

async function createPetWindow(): Promise<void> {
  const cfg = await loadPetConfig()
  const size = getWidgetSizePx(cfg.scale)
  const workArea = screen.getPrimaryDisplay().workArea

  const initX = cfg.isFlippedLeft
    ? workArea.x
    : workArea.x + workArea.width - size
  const initY = workArea.y + workArea.height - size

  petWindow = new BrowserWindow({
    x: initX,
    y: initY,
    width: size,
    height: size,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    title: 'MuSwitch',
    icon: getAppIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void petWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/pet.html`)
  } else {
    void petWindow.loadFile(join(__dirname, '../renderer/pet.html'))
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

/**
 * 以鲸鱼所在贴边角为固定锚点缩放窗口尺寸（右下角或左下角）
 */
function resizePetWindowAnchored(newScale: number, isFlippedLeft?: boolean): void {
  if (!petWindow || petWindow.isDestroyed()) return
  const bounds = petWindow.getBounds()
  const newSize = getWidgetSizePx(newScale)
  if (bounds.width === newSize && bounds.height === newSize) return

  const newX = isFlippedLeft
    ? bounds.x
    : bounds.x + bounds.width - newSize
  const newY = bounds.y + bounds.height - newSize

  petWindow.setBounds({
    x: Math.round(newX),
    y: Math.round(newY),
    width: newSize,
    height: newSize
  })
}

/**
 * 松手后执行四边吸附与左贴边水平镜像翻转判定
 */
async function settlePetWindowSnap(): Promise<PetConfig> {
  const cfg = await loadPetConfig()
  if (!petWindow || petWindow.isDestroyed()) return cfg

  const bounds = petWindow.getBounds()
  const display = screen.getDisplayMatching(bounds)
  const wa = display.workArea

  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2

  let targetX = bounds.x
  let targetY = bounds.y

  const snap = cfg.snap
  if (snap.mode !== 'off') {
    const toPxX = (v: number) => (snap.mode === 'ratio' ? (wa.width * v) / 100 : v)
    const toPxY = (v: number) => (snap.mode === 'ratio' ? (wa.height * v) / 100 : v)

    const leftZone = toPxX(snap.left)
    const rightZone = toPxX(snap.right)
    const topZone = toPxY(snap.top)
    const bottomZone = toPxY(snap.bottom)

    if (leftZone > 0 && centerX - wa.x <= leftZone) {
      targetX = wa.x
    } else if (rightZone > 0 && wa.x + wa.width - centerX <= rightZone) {
      targetX = wa.x + wa.width - bounds.width
    } else {
      targetX = Math.max(wa.x, Math.min(wa.x + wa.width - bounds.width, targetX))
    }

    if (topZone > 0 && centerY - wa.y <= topZone) {
      targetY = wa.y
    } else if (bottomZone > 0 && wa.y + wa.height - centerY <= bottomZone) {
      targetY = wa.y + wa.height - bounds.height
    } else {
      targetY = Math.max(wa.y, Math.min(wa.y + wa.height - bounds.height, targetY))
    }
  } else {
    targetX = Math.max(wa.x, Math.min(wa.x + wa.width - bounds.width, targetX))
    targetY = Math.max(wa.y, Math.min(wa.y + wa.height - bounds.height, targetY))
  }

  petWindow.setBounds({
    x: Math.round(targetX),
    y: Math.round(targetY),
    width: bounds.width,
    height: bounds.height
  })

  const finalCenterX = targetX + bounds.width / 2
  let isFlippedLeft = Boolean(cfg.isFlippedLeft)
  if (snap.flipOnLeft) {
    const flipPx =
      snap.mode === 'px'
        ? snap.flipThreshold
        : (wa.width * (snap.flipThreshold || 30)) / 100
    isFlippedLeft = finalCenterX - wa.x <= flipPx
  } else {
    isFlippedLeft = false
  }

  if (isFlippedLeft !== Boolean(cfg.isFlippedLeft)) {
    const updated = await savePetConfig({ isFlippedLeft })
    broadcastPetConfig(updated)
    return updated
  }

  return cfg
}

function computeStudioPopupPosition(winW: number, winH: number): { x: number; y: number } {
  const wa = petWindow && !petWindow.isDestroyed()
    ? screen.getDisplayMatching(petWindow.getBounds()).workArea
    : screen.getPrimaryDisplay().workArea

  if (!petWindow || petWindow.isDestroyed()) {
    return {
      x: Math.round(wa.x + (wa.width - winW) / 2),
      y: Math.round(wa.y + (wa.height - winH) / 2)
    }
  }

  const pb = petWindow.getBounds()
  const petCenterX = pb.x + pb.width / 2
  const isLeftHalf = petCenterX < wa.x + wa.width / 2

  // 如果小鲸鱼在左侧，弹窗放在她右侧；如果小鲸鱼在右侧，弹窗放在她左侧
  let x = isLeftHalf ? pb.x + pb.width + 12 : pb.x - winW - 12
  let y = pb.y + pb.height - winH

  x = Math.max(wa.x + 12, Math.min(wa.x + wa.width - winW - 12, x))
  y = Math.max(wa.y + 12, Math.min(wa.y + wa.height - winH - 12, y))

  return { x: Math.round(x), y: Math.round(y) }
}

function openStudioWindow(options?: { tab?: ProcessTabId; taskId?: string }): void {
  const tab = options?.tab ?? 'converter'
  const taskId = options?.taskId ?? activeProcessTaskId ?? ''
  currentStudioTab = tab
  if (options?.taskId) {
    activeProcessTaskId = options.taskId
  }

  if (processWindow && !processWindow.isDestroyed()) {
    processWindow.webContents.send('studio:navigate', {
      tab,
      taskId: activeProcessTaskId
    })
    if (processWindow.isMinimized()) processWindow.restore()
    processWindow.show()
    processWindow.focus()
    return
  }

  const winW = 540
  const winH = 660
  const pos = computeStudioPopupPosition(winW, winH)

  const win = new BrowserWindow({
    x: pos.x,
    y: pos.y,
    width: winW,
    height: winH,
    minWidth: 500,
    minHeight: 560,
    show: false,
    icon: getAppIconPath(),
    title: 'MuSwitch · 跨平台音乐格式转换',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  processWindow = win

  const params = new URLSearchParams()
  if (taskId) params.set('taskId', taskId)
  params.set('tab', tab)

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/process.html?${params.toString()}`)
  } else {
    const query: Record<string, string> = { tab }
    if (taskId) query.taskId = taskId
    void win.loadFile(join(__dirname, '../renderer/process.html'), { query })
  }

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show()
      win.focus()
    }
  })

  win.on('closed', () => {
    if (activeProcessTaskId) {
      abortTaskJob(activeProcessTaskId)
      taskStore.delete(activeProcessTaskId)
    }
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
    if (activeProcessTaskId) {
      abortTaskJob(activeProcessTaskId)
      taskStore.delete(activeProcessTaskId)
    }
    const id = randomUUID()
    taskStore.set(id, task)
    activeProcessTaskId = id
    openStudioWindow({ tab: 'converter', taskId: id })
    return id
  })

  ipcMain.handle('studio:open', async (_, payload?: { tab?: ProcessTabId }) => {
    openStudioWindow({ tab: payload?.tab ?? 'converter' })
  })

  ipcMain.handle('studio:pick-files', async (_, mode: 'audio' | 'folder') => {
    const parent = processWindow ?? petWindow
    if (mode === 'folder') {
      const opts: Electron.OpenDialogOptions = {
        title: '选择要打包为 ZIP 的文件夹',
        properties: ['openDirectory']
      }
      const res = parent
        ? await dialog.showOpenDialog(parent, opts)
        : await dialog.showOpenDialog(opts)
      if (res.canceled || res.filePaths.length === 0) return null
      const task = await analyzePaths([res.filePaths[0]])
      const id = randomUUID()
      taskStore.set(id, task)
      activeProcessTaskId = id
      return { taskId: id, task }
    } else {
      const exts = [...COMMON_AUDIO_EXT, ...PROPRIETARY_EXT]
      const opts: Electron.OpenDialogOptions = {
        title: '选择要转换或压缩的音频/视频文件（可多选）',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: '音频文件', extensions: exts }]
      }
      const res = parent
        ? await dialog.showOpenDialog(parent, opts)
        : await dialog.showOpenDialog(opts)
      if (res.canceled || res.filePaths.length === 0) return null
      const task = await analyzePaths(res.filePaths)
      const id = randomUUID()
      taskStore.set(id, task)
      activeProcessTaskId = id
      return { taskId: id, task }
    }
  })

  ipcMain.handle('task:get', async (_, taskId: string) => {
    if (!taskId && activeProcessTaskId) {
      return taskStore.get(activeProcessTaskId) ?? null
    }
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
        petWindow?.webContents.send('pet:job-completed', {
          kind: 'folder',
          count: 1,
          outputDir: outDir
        })
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
        compressProfile?: 'lossy' | 'lossless'
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
        petWindow?.webContents.send('pet:job-completed', {
          kind: 'audio',
          count: outputs.length,
          format: resolved.format.toUpperCase(),
          outputDir: outDir
        })
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

  // 小鲸鱼指针拖拽与屏幕四边吸附
  ipcMain.handle('pet:drag-start', async () => {
    if (!petWindow || petWindow.isDestroyed()) return
    dragStartCursor = screen.getCursorScreenPoint()
    dragStartBounds = petWindow.getBounds()
  })

  ipcMain.handle('pet:drag-move', async () => {
    if (!petWindow || petWindow.isDestroyed() || !dragStartCursor || !dragStartBounds) return
    const cur = screen.getCursorScreenPoint()
    const dx = cur.x - dragStartCursor.x
    const dy = cur.y - dragStartCursor.y
    petWindow.setBounds({
      x: Math.round(dragStartBounds.x + dx),
      y: Math.round(dragStartBounds.y + dy),
      width: dragStartBounds.width,
      height: dragStartBounds.height
    })
  })

  ipcMain.handle('pet:drag-end', async () => {
    dragStartCursor = null
    dragStartBounds = null
    return settlePetWindowSnap()
  })

  ipcMain.handle('pet:get-config', async () => {
    return loadPetConfig()
  })

  ipcMain.handle('pet:save-config', async (_, partial: Partial<PetConfig>) => {
    const saved = await savePetConfig(partial)
    if (partial.scale !== undefined) {
      resizePetWindowAnchored(saved.scale, saved.isFlippedLeft)
    }
    if (partial.snap !== undefined) {
      await settlePetWindowSnap()
    }
    broadcastPetConfig(saved)
    return saved
  })

  ipcMain.handle('pet:pick-raw-image', async () => {
    return pickImageFileAsDataUrl(processWindow ?? petWindow)
  })

  ipcMain.handle('pet:pick-raw-audio', async () => {
    return pickAudioFileAsDataUrl(processWindow ?? petWindow)
  })

  ipcMain.handle('pet:import-image', async (_, sourcePath: string) => {
    const saved = await importPetImageFromPath(sourcePath)
    broadcastPetConfig(saved)
    return saved
  })
}

function setupChineseAppMenu(): void {
  const isMac = process.platform === 'darwin'

  const viewSubmenu: MenuItemConstructorOptions[] = [
    { label: '重新加载', role: 'reload' },
    { label: '强制重新加载', role: 'forceReload' },
    { type: 'separator' },
    { label: '实际大小', role: 'resetZoom' },
    { label: '放大', role: 'zoomIn' },
    { label: '缩小', role: 'zoomOut' },
    { type: 'separator' },
    { label: '切换全屏', role: 'togglefullscreen' },
    ...(isDev
      ? [
          { type: 'separator' as const },
          { label: '开发者工具', role: 'toggleDevTools' as const }
        ]
      : [])
  ]

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'MuSwitch',
            submenu: [
              { label: '关于 MuSwitch', role: 'about' as const },
              { type: 'separator' as const },
              { label: '隐藏', role: 'hide' as const },
              { label: '隐藏其他', role: 'hideOthers' as const },
              { label: '显示全部', role: 'unhide' as const },
              { type: 'separator' as const },
              { label: '退出 MuSwitch', role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: '文件',
      submenu: [
        {
          label: '打开音乐转换器',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            openStudioWindow({ tab: 'converter' })
          }
        },
        {
          label: '打开转换输出目录',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            void ensureOutputDir().then((dir) => shell.openPath(dir))
          }
        },
        { type: 'separator' },
        { label: '关闭窗口', role: 'close' },
        {
          label: '退出 MuSwitch',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            for (const taskId of Array.from(jobAbortControllers.keys())) {
              abortTaskJob(taskId)
            }
            app.quit()
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: viewSubmenu
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        {
          label: '显示 MuSwitch 桌宠',
          click: () => {
            if (petWindow && !petWindow.isDestroyed()) {
              if (petWindow.isMinimized()) {
                petWindow.restore()
              }
              petWindow.show()
              petWindow.focus()
            } else {
              void createPetWindow()
            }
          }
        },
        {
          label: '打开音乐转换器',
          click: () => {
            openStudioWindow({ tab: 'converter' })
          }
        },
        {
          label: '桌宠形象与音效设置',
          click: () => {
            openStudioWindow({ tab: 'sound-role' })
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 MuSwitch',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: '关于 MuSwitch',
              message: 'MuSwitch',
              detail: `版本：v${app.getVersion()}\n\n跨平台音乐格式转换工具 · 桌面挂件`,
              buttons: ['确定']
            })
          }
        },
        {
          label: '访问 GitHub 项目主页',
          click: () => {
            void shell.openExternal('https://github.com/Simon77Xx/Music-Converter')
          }
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  await ensureOutputDir()
  registerIpc()
  setupChineseAppMenu()
  await createPetWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createPetWindow()
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
