import type {
  AudioOutputFormat,
  DropTask,
  JobProgressPayload,
  PetConfig,
  ProcessTabId
} from '../../shared/types'

export {}

declare global {
  interface Window {
    softcreate: {
      getPathForFile: (file: File) => string
      analyzeDrop: (paths: string[]) => Promise<DropTask>
      openTask: (task: DropTask) => Promise<string>
      openStudio: (tab?: ProcessTabId) => Promise<void>
      pickFilesForStudio: (mode: 'audio' | 'folder') => Promise<{
        taskId: string
        task: DropTask
      } | null>
      onStudioNavigate: (
        cb: (payload: { tab: ProcessTabId; taskId?: string | null }) => void
      ) => () => void
      getTask: (taskId: string) => Promise<DropTask | null>
      getOutputDir: () => Promise<string>
      getDefaultOutputDir: () => Promise<string>
      pickOutputDir: () => Promise<string | null>
      setOutputDir: (dir: string | null) => Promise<string>
      getParentDir: (filePath: string) => Promise<string>
      zipFolder: (
        taskId: string,
        folderPath: string,
        outputDir?: string
      ) => Promise<{ outputPath: string }>
      transcode: (payload: {
        taskId: string
        paths: string[]
        outputFormat: AudioOutputFormat
        mode: 'convert' | 'compress'
        outputDir?: string
        bitrateKbps?: number
        compressProfile?: 'lossy' | 'lossless'
        flacCompressionLevel?: number
      }) => Promise<{ outputPaths: string[]; outputDir: string }>
      cancelJob: (taskId: string) => Promise<void>
      onJobProgress: (cb: (payload: JobProgressPayload) => void) => () => void
      onJobCompleted: (
        cb: (payload: {
          kind: 'audio' | 'folder'
          count: number
          format?: string
          outputDir: string
        }) => void
      ) => () => void
      openPath: (p: string) => Promise<void>
      showItemInFolder: (p: string) => Promise<void>
      closeProcessWindow: () => Promise<void>
      quitApp: () => Promise<void>
      setPetIgnoreMouse: (ignore: boolean) => Promise<void>
      petDragStart: () => Promise<void>
      petDragMove: () => Promise<void>
      petDragEnd: () => Promise<PetConfig>
      getPetConfig: () => Promise<PetConfig>
      savePetConfig: (partial: Partial<PetConfig>) => Promise<PetConfig>
      onPetConfigUpdated: (cb: (cfg: PetConfig) => void) => () => void
      pickRawImage: () => Promise<{
        name: string
        dataUrl: string
        isGif: boolean
      } | null>
      pickRawAudio: () => Promise<{
        name: string
        dataUrl: string
      } | null>
      importPetImage: (sourcePath: string) => Promise<PetConfig>
    }
  }
}
