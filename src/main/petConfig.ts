import { app, BrowserWindow, dialog } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  BubbleImageItem,
  BubbleModuleStyle,
  PetConfig,
  WhaleRoleItem
} from '../shared/types'

export const DEFAULT_STYLE_LABEL: BubbleModuleStyle = {
  fontFamily: '',
  fontSize: 66,
  bold: true,
  italic: false,
  underline: false,
  colorMode: 'solid',
  color: '#536ba9',
  bgColor: ''
}

export const DEFAULT_STYLE_MAIN: BubbleModuleStyle = {
  fontFamily: '',
  fontSize: 108,
  bold: true,
  italic: false,
  underline: false,
  colorMode: 'solid',
  color: '#203170',
  bgColor: ''
}

export const DEFAULT_STYLE_HINT: BubbleModuleStyle = {
  fontFamily: '',
  fontSize: 54,
  bold: false,
  italic: false,
  underline: false,
  colorMode: 'solid',
  color: '#9fb0d9',
  bgColor: ''
}

export const BUILTIN_ROLES: WhaleRoleItem[] = [
  {
    id: 'builtin-whale',
    name: '默认小鲸鱼',
    dataUrl: './whale/DSniang1.png',
    isGif: false,
    builtin: true
  },
  {
    id: 'builtin-rua-gif',
    name: '撒娇小鲸鱼 (GIF)',
    dataUrl: './whale/rua.gif',
    isGif: true,
    builtin: true
  }
]

export const BUILTIN_BUBBLE_IMAGES: BubbleImageItem[] = [
  {
    id: 'builtin-petpet',
    name: '摸摸头 (petpet)',
    url: './whale/bubble-petpet.gif',
    builtin: true
  },
  {
    id: 'builtin-rua',
    name: '撒娇动图 (rua)',
    url: './whale/rua.gif',
    builtin: true
  },
  {
    id: 'builtin-money1',
    name: '开心欢呼 (money1)',
    url: './whale/bubble-money1.gif',
    builtin: true
  }
]

export const DEFAULT_PET_CONFIG: PetConfig = {
  scale: 1.0,
  activeRoleId: 'builtin-whale',
  roles: BUILTIN_ROLES,
  bubbleImages: BUILTIN_BUBBLE_IMAGES,
  bubbleOn: true,
  clickRoleAdvanceQueue: true,
  clickOpensConverter: true,
  hideMenuBtn: false,
  firstClickBubble: {
    id: 'first-click',
    name: '首次点击泡',
    rows: [
      [
        {
          id: 'm-welcome-1',
          kind: 'text',
          text: 'MuSwitch 桌面音律站',
          style: { ...DEFAULT_STYLE_LABEL }
        }
      ],
      [
        {
          id: 'm-welcome-2',
          kind: 'text',
          text: '点我转格式 ♪',
          style: {
            ...DEFAULT_STYLE_MAIN,
            colorMode: 'marquee-ocean'
          }
        }
      ],
      [
        {
          id: 'm-welcome-3',
          kind: 'status',
          text: '拖入音乐或文件夹即可处理',
          style: { ...DEFAULT_STYLE_HINT }
        }
      ]
    ]
  },
  repeatSequence: [
    {
      id: 'step-1',
      mode: 'ab',
      weightA: 70,
      weightB: 30,
      bubbleA: {
        id: 'b-step1-a',
        name: '随机台词泡',
        rows: [
          [
            {
              id: 'm-rand-1',
              kind: 'random-text',
              randomSentences: [
                { id: 's1', text: '压力一只蓝色大肥鱼 ~', weight: 20 },
                { id: 's2', text: '今天想转什么好听的歌呀？', weight: 15 },
                { id: 's3', text: '我去吃饭啦 ♪', weight: 10 },
                { id: 's4', text: '摸摸小鲸鱼，音质加倍！', weight: 15 },
                { id: 's5', text: 'DeepSleep… 呼噜噜', weight: 8 }
              ],
              style: {
                ...DEFAULT_STYLE_LABEL,
                fontSize: 74,
                color: '#203170'
              }
            }
          ]
        ]
      },
      bubbleB: {
        id: 'b-step1-b',
        name: '摸头动图泡',
        rows: [
          [
            {
              id: 'm-img-1',
              kind: 'image',
              imageUrl: './whale/bubble-petpet.gif',
              style: { ...DEFAULT_STYLE_MAIN }
            }
          ]
        ]
      }
    },
    {
      id: 'step-2',
      mode: 'single',
      weightA: 100,
      bubbleA: {
        id: 'b-step2-a',
        name: '三行撒娇泡',
        rows: [
          [
            {
              id: 'm-s2-1',
              kind: 'text',
              text: '这个音频',
              style: { ...DEFAULT_STYLE_LABEL }
            }
          ],
          [
            {
              id: 'm-s2-2',
              kind: 'text',
              text: '超好听!',
              style: {
                ...DEFAULT_STYLE_MAIN,
                colorMode: 'marquee-sakura'
              }
            }
          ],
          [
            {
              id: 'm-s2-3',
              kind: 'text',
              text: '直接拖到我身上就能秒转格式哦~',
              style: { ...DEFAULT_STYLE_HINT }
            }
          ]
        ]
      }
    }
  ],
  moduleLibrary: [
    {
      id: 'lib-1',
      name: '霓虹标题',
      kind: 'text',
      text: '小鲸鱼音律站 ♪',
      style: { ...DEFAULT_STYLE_MAIN, colorMode: 'marquee-ocean' }
    },
    {
      id: 'lib-2',
      name: '撒娇语句池',
      kind: 'random-text',
      randomSentences: [
        { id: 'ls1', text: '压力一只蓝色大肥鱼 ~', weight: 20 },
        { id: 'ls2', text: '摸摸头 ♪', weight: 15 }
      ],
      style: { ...DEFAULT_STYLE_LABEL, fontSize: 72 }
    }
  ],
  snap: {
    mode: 'ratio',
    left: 25,
    right: 25,
    top: 0,
    bottom: 25,
    flipOnLeft: true,
    flipThreshold: 30
  },
  sound: {
    enabled: true,
    pressSet: 'duck',
    pressVolume: 0.85,
    taskEndSound: 'exp_orb',
    taskEndVolume: 0.9,
    followPressVolume: true
  },
  isFlippedLeft: false
}

function getUserConfigDir(): string {
  return join(app.getPath('userData'), 'whale-widget-v2')
}

function getConfigJsonPath(): string {
  return join(getUserConfigDir(), 'whale-config.json')
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
    case '.wav':
      return 'audio/wav'
    case '.mp3':
      return 'audio/mpeg'
    case '.ogg':
      return 'audio/ogg'
    default:
      return 'application/octet-stream'
  }
}

export async function loadPetConfig(): Promise<PetConfig> {
  const jsonPath = getConfigJsonPath()
  try {
    if (!existsSync(jsonPath)) {
      return structuredClone(DEFAULT_PET_CONFIG)
    }
    const raw = await readFile(jsonPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<PetConfig>

    // 确保内置角色与内置泡泡图始终在最前面
    const userRoles = (parsed.roles ?? []).filter((r) => !r.builtin)
    const userImgs = (parsed.bubbleImages ?? []).filter((i) => !i.builtin)

    return {
      ...structuredClone(DEFAULT_PET_CONFIG),
      ...parsed,
      roles: [...BUILTIN_ROLES, ...userRoles],
      bubbleImages: [...BUILTIN_BUBBLE_IMAGES, ...userImgs],
      snap: {
        ...DEFAULT_PET_CONFIG.snap,
        ...(parsed.snap ?? {})
      },
      sound: {
        ...DEFAULT_PET_CONFIG.sound,
        ...(parsed.sound ?? {})
      }
    }
  } catch {
    return structuredClone(DEFAULT_PET_CONFIG)
  }
}

export async function savePetConfig(partial: Partial<PetConfig>): Promise<PetConfig> {
  const dir = getUserConfigDir()
  await mkdir(dir, { recursive: true })
  const current = await loadPetConfig()

  const merged: PetConfig = {
    ...current,
    ...partial,
    snap: {
      ...current.snap,
      ...(partial.snap ?? {})
    },
    sound: {
      ...current.sound,
      ...(partial.sound ?? {})
    }
  }

  await writeFile(getConfigJsonPath(), JSON.stringify(merged, null, 2), 'utf-8')
  return loadPetConfig()
}

export async function pickImageFileAsDataUrl(
  parentWin?: BrowserWindow | null
): Promise<{ name: string; dataUrl: string; isGif: boolean } | null> {
  const opts: Electron.OpenDialogOptions = {
    title: '选择角色图片或 GIF 动图',
    properties: ['openFile'],
    filters: [
      {
        name: '图片 / 动图',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
      }
    ]
  }
  const res = parentWin
    ? await dialog.showOpenDialog(parentWin, opts)
    : await dialog.showOpenDialog(opts)

  if (res.canceled || res.filePaths.length === 0) return null
  return readLocalImageAsDataUrl(res.filePaths[0])
}

export async function readLocalImageAsDataUrl(
  filePath: string
): Promise<{ name: string; dataUrl: string; isGif: boolean }> {
  const buf = await readFile(filePath)
  const ext = extname(filePath).toLowerCase()
  const mime = getMimeByExt(ext)
  const name = basename(filePath, ext)
  return {
    name,
    dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
    isGif: ext === '.gif'
  }
}

export async function pickAudioFileAsDataUrl(
  parentWin?: BrowserWindow | null
): Promise<{ name: string; dataUrl: string } | null> {
  const opts: Electron.OpenDialogOptions = {
    title: '选择自定义音效文件 (WAV / MP3 / OGG)',
    properties: ['openFile'],
    filters: [
      {
        name: '音频文件',
        extensions: ['wav', 'mp3', 'ogg']
      }
    ]
  }
  const res = parentWin
    ? await dialog.showOpenDialog(parentWin, opts)
    : await dialog.showOpenDialog(opts)

  if (res.canceled || res.filePaths.length === 0) return null
  const p = res.filePaths[0]
  const buf = await readFile(p)
  const ext = extname(p).toLowerCase()
  const mime = getMimeByExt(ext)
  return {
    name: basename(p, ext),
    dataUrl: `data:${mime};base64,${buf.toString('base64')}`
  }
}

export async function importPetImageFromPath(sourcePath: string): Promise<PetConfig> {
  const img = await readLocalImageAsDataUrl(sourcePath)
  const cfg = await loadPetConfig()
  const newRole: WhaleRoleItem = {
    id: `role-${randomUUID().slice(0, 8)}`,
    name: img.name || '自定义角色',
    dataUrl: img.dataUrl,
    isGif: img.isGif,
    builtin: false
  }
  return savePetConfig({
    roles: [...cfg.roles, newRole],
    activeRoleId: newRole.id
  })
}
