import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AudioOutputFormat,
  DropTask,
  JobProgressPayload,
  PetConfig
} from '../shared/types'

contextBridge.exposeInMainWorld('softcreate', {
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  analyzeDrop: (paths: string[]) =>
    ipcRenderer.invoke('drop:analyze', paths) as Promise<DropTask>,

  openTask: (task: DropTask) => ipcRenderer.invoke('task:open', task) as Promise<string>,

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

  openPath: (p: string) => ipcRenderer.invoke('shell:open-path', p) as Promise<void>,
  showItemInFolder: (p: string) => ipcRenderer.invoke('shell:show-item', p) as Promise<void>,

  closeProcessWindow: () => ipcRenderer.invoke('window:close-process') as Promise<void>,

  quitApp: () => ipcRenderer.invoke('app:quit') as Promise<void>,

  setPetIgnoreMouse: (ignore: boolean) =>
    ipcRenderer.invoke('pet:set-ignore-mouse', ignore) as Promise<void>,

  getPetConfig: () => ipcRenderer.invoke('pet:get-config') as Promise<PetConfig>,

  savePetConfig: (partial: Partial<PetConfig>) =>
    ipcRenderer.invoke('pet:save-config', partial) as Promise<PetConfig>,

  pickPetImage: () => ipcRenderer.invoke('pet:pick-image') as Promise<PetConfig | null>,

  importPetImage: (sourcePath: string) =>
    ipcRenderer.invoke('pet:import-image', sourcePath) as Promise<PetConfig>
})

