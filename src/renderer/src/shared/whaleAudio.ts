import type { WhaleSoundConfig } from '../../../shared/types'

let audioCtx: AudioContext | null = null
const bufferCache = new Map<string, AudioBuffer>()

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new AC({ latencyHint: 'interactive' })
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

function loadArrayBuffer(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'arraybuffer'
    xhr.onload = () => {
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
        if (xhr.response && (xhr.response as ArrayBuffer).byteLength > 0) {
          resolve(xhr.response as ArrayBuffer)
          return
        }
      }
      reject(new Error(`Failed to load audio: ${url} (status ${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error(`XHR error loading audio: ${url}`))
    xhr.send()
  })
}

export async function decodeAudioUrl(url: string): Promise<AudioBuffer | null> {
  if (!url) return null
  if (bufferCache.has(url)) {
    return bufferCache.get(url)!
  }
  try {
    const arr = await loadArrayBuffer(url)
    const ctx = getAudioContext()
    if (!ctx) return null
    const buf = await ctx.decodeAudioData(arr)
    bufferCache.set(url, buf)
    return buf
  } catch {
    return null
  }
}

export async function playAudioUrl(url: string, volume = 0.85): Promise<void> {
  if (!url || volume <= 0) return
  const clampedVol = Math.min(1, Math.max(0, volume))

  try {
    const ctx = getAudioContext()
    const buf = await decodeAudioUrl(url)
    if (ctx && buf) {
      const src = ctx.createBufferSource()
      src.buffer = buf
      const gain = ctx.createGain()
      gain.gain.value = clampedVol
      src.connect(gain)
      gain.connect(ctx.destination)
      src.start(0)
      return
    }
  } catch {
    // fallback to HTMLAudioElement below
  }

  try {
    const audio = new Audio(url)
    audio.volume = clampedVol
    await audio.play()
  } catch {
    // ignore playback error
  }
}

export function getPressSoundUrl(sound: WhaleSoundConfig): string | null {
  if (!sound.enabled || sound.pressSet === 'off') return null
  if (sound.pressSet === 'duck') return './whale/Ya1.mp3'
  if (sound.pressSet === 'fx1') return './whale/D1.mp3'
  if (sound.pressSet === 'custom') return sound.customPressDataUrl ?? './whale/Ya1.mp3'
  return null
}

export function getReleaseSoundUrl(sound: WhaleSoundConfig): string | null {
  if (!sound.enabled || sound.pressSet === 'off') return null
  if (sound.pressSet === 'duck') return './whale/Ya2.mp3'
  if (sound.pressSet === 'fx1') return './whale/D2.mp3'
  if (sound.pressSet === 'custom') return sound.customReleaseDataUrl ?? './whale/Ya2.mp3'
  return null
}

export function getTaskEndSoundUrl(sound: WhaleSoundConfig): string | null {
  if (!sound.enabled || sound.taskEndSound === 'off') return null
  if (sound.taskEndSound === 'exp_orb') return './whale/minecraft-exp-orb.wav'
  if (sound.taskEndSound === 'end_a') return './whale/task-end-a.wav'
  if (sound.taskEndSound === 'custom') {
    return sound.customTaskEndDataUrl ?? './whale/minecraft-exp-orb.wav'
  }
  return null
}

export function playPressSound(sound: WhaleSoundConfig): void {
  const url = getPressSoundUrl(sound)
  if (url) void playAudioUrl(url, sound.pressVolume)
}

export function playReleaseSound(sound: WhaleSoundConfig): void {
  const url = getReleaseSoundUrl(sound)
  if (url) void playAudioUrl(url, sound.pressVolume)
}

export function playTaskEndSound(sound: WhaleSoundConfig): void {
  const url = getTaskEndSoundUrl(sound)
  const vol = sound.followPressVolume ? sound.pressVolume : sound.taskEndVolume
  if (url) void playAudioUrl(url, vol)
}

/**
 * 将 AudioBuffer 指定时间段 [startSec, endSec] 裁剪并编码为 WAV DataURL
 */
export function encodeAudioBufferSliceToWavDataUrl(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number
): string {
  const sampleRate = buffer.sampleRate
  const numChannels = Math.min(2, buffer.numberOfChannels)
  const startFrame = Math.max(0, Math.floor(startSec * sampleRate))
  const endFrame = Math.min(
    buffer.length,
    Math.max(startFrame + 1, Math.floor(endSec * sampleRate))
  )
  const frameCount = endFrame - startFrame
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = frameCount * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch))
  }

  let offset = 44
  for (let i = startFrame; i < endFrame; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:audio/wav;base64,${btoa(binary)}`
}
