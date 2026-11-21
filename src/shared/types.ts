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

export type ProcessTabId = 'converter' | 'bubble' | 'snap' | 'sound-role'

export type BubbleModuleKind =
  | 'text'
  | 'random-text'
  | 'image'
  | 'random-image'
  | 'status'

export type BubbleColorMode =
  | 'solid'
  | 'marquee-ocean'
  | 'marquee-sakura'
  | 'marquee-rainbow'
  | 'marquee-gold'

export interface BubbleModuleStyle {
  fontFamily: string
  /** 字号（相对挂件画布 u 单位，40 ~ 140，默认 66 或 104） */
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
  colorMode: BubbleColorMode
  color: string
  bgColor: string
}

export interface WeightedSentence {
  id: string
  text: string
  weight: number
}

export interface WeightedImage {
  id: string
  name: string
  url: string
  weight: number
}

export interface BubbleModule {
  id: string
  name?: string
  kind: BubbleModuleKind
  text?: string
  randomSentences?: WeightedSentence[]
  imageUrl?: string
  randomImages?: WeightedImage[]
  style: BubbleModuleStyle
}

export interface BubbleCardConfig {
  id: string
  name: string
  /** 最多 6 行，每行最多 6 个模块 */
  rows: BubbleModule[][]
}

export interface BubbleSequenceStep {
  id: string
  /** 'single': 单个泡泡；'ab': A/B 并列按权重随机抽一个 */
  mode: 'single' | 'ab'
  bubbleA: BubbleCardConfig
  weightA: number
  bubbleB?: BubbleCardConfig
  weightB?: number
}

export interface SnapAndFlipConfig {
  mode: 'ratio' | 'px' | 'off'
  /** 左吸附区阈值（ratio 模式下为 0-50%，px 模式下为像素） */
  left: number
  right: number
  top: number
  bottom: number
  /** 进入左侧翻转触发区时自动水平镜像翻转 */
  flipOnLeft: boolean
  /** 左翻转触发线阈值（ratio 模式下 0-50%，px 模式下像素） */
  flipThreshold: number
}

export interface WhaleSoundConfig {
  enabled: boolean
  pressSet: 'duck' | 'fx1' | 'custom' | 'off'
  pressVolume: number
  taskEndSound: 'exp_orb' | 'end_a' | 'custom' | 'off'
  taskEndVolume: number
  followPressVolume: boolean
  customPressDataUrl?: string
  customReleaseDataUrl?: string
  customTaskEndDataUrl?: string
}

export interface WhaleRoleItem {
  id: string
  name: string
  dataUrl: string
  isGif?: boolean
  builtin?: boolean
}

export interface BubbleImageItem {
  id: string
  name: string
  url: string
  builtin?: boolean
}

export interface PetConfig {
  /** 缩放比例 0.6 ~ 2.5（对应菜单等级 1 ~ 20，默认 1.0） */
  scale: number
  activeRoleId: string
  roles: WhaleRoleItem[]
  bubbleImages: BubbleImageItem[]
  /** 是否开启气泡 */
  bubbleOn: boolean
  /** 点按角色时是否往后推进泡泡点击序列 */
  clickRoleAdvanceQueue: boolean
  /** 左键单击角色时是否直接弹出转换格式界面 */
  clickOpensConverter: boolean
  /** 隐藏右上角 ☰ 按钮（可通过右键唤出菜单） */
  hideMenuBtn: boolean
  /** 首次点击泡 */
  firstClickBubble: BubbleCardConfig
  /** 再次点击序列（支持任意增删排序与 A/B 并列加权） */
  repeatSequence: BubbleSequenceStep[]
  /** 常用模块库 */
  moduleLibrary: BubbleModule[]
  /** 四边吸附与翻转配置 */
  snap: SnapAndFlipConfig
  /** 音效配置 */
  sound: WhaleSoundConfig
  /** 当前是否处于左侧镜像翻转状态 */
  isFlippedLeft?: boolean
}
