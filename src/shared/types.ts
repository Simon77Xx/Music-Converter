export type DropKind = 'folder' | 'audio' | 'batch-audio' | 'unsupported'

export interface DropTask {
  kind: DropKind
  paths: string[]
  label: string
  proprietary?: boolean
}

export type AudioOutputFormat =
  | 'mp3'
  | 'm4a'
  | 'aac'
  | 'wav'
  | 'flac'
  | 'ogg'
  | 'opus'
  | 'wma'

export interface JobProgressPayload {
  taskId: string
  ratio: number
}

export type PetPresetId = 'cat' | 'robot' | 'fox' | 'headphone' | 'custom'
export type PetShapeMode = 'full' | 'circle' | 'rounded-card'
export type PetAnimationMode = 'float' | 'bounce' | 'pulse' | 'none'
export type PetThemeColor = 'blue' | 'pink' | 'emerald' | 'violet'

export interface PetConfig {
  /** 桌宠名字 */
  name: string
  /** 预设形象或自定义上传 ('custom') */
  presetId: PetPresetId
  /** 用户上传的图片 DataURL（由主进程从 userData 读取生成） */
  customImageDataUrl?: string
  /** 照片展示形态：全身立绘(contain) / 圆形头像(cover) / 圆角相框(cover) */
  shapeMode: PetShapeMode
  /** 动态动画效果 */
  animation: PetAnimationMode
  /** 形象缩放比例 (0.6 ~ 1.4) */
  scale: number
  /** 自定义气泡/欢迎台词 */
  greeting: string
  /** 是否隐藏背景框（纯立绘悬浮模式） */
  hideFrame: boolean
  /** 主题色 */
  theme: PetThemeColor
}


