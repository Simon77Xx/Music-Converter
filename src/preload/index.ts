import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AudioOutputFormat,
  DropTask,
  JobProgressPayload,
  PetConfig,
  ProcessTabId
} from '../shared/types'

contextBridge.exposeInMainWorld('softcreate', {
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  analyzeDrop: (paths: string[]) =>
    ipcRenderer.invoke('drop:analyze', paths) as Promise<DropTask>,

  openTask: (task: DropTask) => ipcRenderer.invoke('task:open', task) as Promise<string>,

  openStudio: (tab?: ProcessTabId) =>
    ipcRenderer.invoke('studio:open', { tab }) as Promise<void>,

  pickFilesForStudio: (mode: 'audio' | 'folder') =>
    ipcRenderer.invoke('studio:pick-files', mode) as Promise<{
      taskId: string
      task: DropTask
    } | null>,

  onStudioNavigate: (cb: (payload: { tab: ProcessTabId; taskId?: string | null }) => void) => {
    const listener = (
      _: unknown,
      payload: { tab: ProcessTabId; taskId?: string | null }
    ) => cb(payload)
    ipcRenderer.on('studio:navigate', listener)
    return () => ipcRenderer.removeListener('studio:navigate', listener)
  },

  getTask: (taskId: string) =>
    ipcRenderer.invoke('task:get', taskId) as Promise<DropTask | null>,

  getOutputDir: () => ipcRenderer.invoke('paths:output-dir') as Promise<string>,

  getDefaultOutputDir: () =>
    ipcRenderer.invoke('paths:default-output-dir') as Promise<string>,

  pickOutputDir: () =>
    ipcRenderer.invoke('paths:pick-output-dir') as Promise<string | null>,

  setOutputDir: (dir: string | null) =>
    ipcRenderer.invoke('paths:set-output-dir', dir) as Promise<string>,

  getParentDir: (filePath: string) =>
    ipcRenderer.invoke('paths:parent-dir', filePath) as Promise<string>,

  zipFolder: (taskId: string, folderPath: string, outputDir?: string) =>
    ipcRenderer.invoke('job:zip-folder', { taskId, folderPath, outputDir }) as Promise<{
      outputPath: string
    }>,

  transcode: (payload: {
    taskId: string
    paths: string[]
    outputFormat: AudioOutputFormat
    mode: 'convert' | 'compress'
    outputDir?: string
    bitrateKbps?: number
    compressProfile?: 'lossy' | 'lossless'
    flacCompressionLevel?: number
  }) =>
    ipcRenderer.invoke('job:transcode', payload) as Promise<{
      outputPaths: string[]
      outputDir: string
    }>,

  cancelJob: (taskId: string) =>
    ipcRenderer.invoke('job:cancel', taskId) as Promise<void>,

  onJobProgress: (cb: (payload: JobProgressPayload) => void) => {
    const listener = (_: unknown, payload: JobProgressPayload) => cb(payload)
    ipcRenderer.on('job:progress', listener)
    return () => ipcRenderer.removeListener('job:progress', listener)
  },

  onJobCompleted: (
    cb: (payload: {
      kind: 'audio' | 'folder'
      count: number
      format?: string
      outputDir: string
    }) => void
  ) => {
    const listener = (
      _: unknown,
      payload: {
        kind: 'audio' | 'folder'
        count: number
        format?: string
        outputDir: string
      }
    ) => cb(payload)
    ipcRenderer.on('pet:job-completed', listener)
    return () => ipcRenderer.removeListener('pet:job-completed', listener)
  },

  openPath: (p: string) => ipcRenderer.invoke('shell:open-path', p) as Promise<void>,
  showItemInFolder: (p: string) => ipcRenderer.invoke('shell:show-item', p) as Promise<void>,

  closeProcessWindow: () => ipcRenderer.invoke('window:close-process') as Promise<void>,

  quitApp: () => ipcRenderer.invoke('app:quit') as Promise<void>,

  setPetIgnoreMouse: (ignore: boolean) =>
    ipcRenderer.invoke('pet:set-ignore-mouse', ignore) as Promise<void>,

  petDragStart: () => ipcRenderer.invoke('pet:drag-start') as Promise<void>,
  petDragMove: () => ipcRenderer.invoke('pet:drag-move') as Promise<void>,
  petDragEnd: () => ipcRenderer.invoke('pet:drag-end') as Promise<PetConfig>,

  getPetConfig: () => ipcRenderer.invoke('pet:get-config') as Promise<PetConfig>,

  savePetConfig: (partial: Partial<PetConfig>) =>
    ipcRenderer.invoke('pet:save-config', partial) as Promise<PetConfig>,

  onPetConfigUpdated: (cb: (cfg: PetConfig) => void) => {
    const listener = (_: unknown, cfg: PetConfig) => cb(cfg)
    ipcRenderer.on('pet:config-updated', listener)
    return () => ipcRenderer.removeListener('pet:config-updated', listener)
  },

  pickRawImage: () =>
    ipcRenderer.invoke('pet:pick-raw-image') as Promise<{
      name: string
      dataUrl: string
      isGif: boolean
    } | null>,

  pickRawAudio: () =>
    ipcRenderer.invoke('pet:pick-raw-audio') as Promise<{
      name: string
      dataUrl: string
    } | null>,

  importPetImage: (sourcePath: string) =>
    ipcRenderer.invoke('pet:import-image', sourcePath) as Promise<PetConfig>
})
