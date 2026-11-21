import type {
  AudioOutputFormat,
  DropTask,
  JobProgressPayload,
  PetConfig
} from '../../shared/types'

export {}

declare global {
  interface Window {
    softcreate: {
      getPathForFile: (file: File) => string
      analyzeDrop: (paths: string[]) => Promise<DropTask>
      openTask: (task: DropTask) => Promise<string>
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
      openPath: (p: string) => Promise<void>
      showItemInFolder: (p: string) => Promise<void>
      closeProcessWindow: () => Promise<void>
      quitApp: () => Promise<void>
      setPetIgnoreMouse: (ignore: boolean) => Promise<void>
      getPetConfig: () => Promise<PetConfig>
      savePetConfig: (partial: Partial<PetConfig>) => Promise<PetConfig>
      pickPetImage: () => Promise<PetConfig | null>
      importPetImage: (sourcePath: string) => Promise<PetConfig>
    }
  }
}

