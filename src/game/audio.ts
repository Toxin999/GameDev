import type Phaser from 'phaser'
import { loadSettings } from './session'

export const SFX = {
  click: 'sfx-click',
  select: 'sfx-select',
  back: 'sfx-back',
  error: 'sfx-error',
  success: 'sfx-success',
  money: 'sfx-money',
} as const

export type SfxKey = keyof typeof SFX

const FILES: Record<SfxKey, string> = {
  click: 'audio/click.ogg',
  select: 'audio/select.ogg',
  back: 'audio/back.ogg',
  error: 'audio/error.ogg',
  success: 'audio/success.ogg',
  money: 'audio/money.ogg',
}

export function preloadSfx(scene: Phaser.Scene): void {
  for (const key of Object.keys(SFX) as SfxKey[]) {
    scene.load.audio(SFX[key], FILES[key])
  }
}

export function playSfx(scene: Phaser.Scene, key: SfxKey, volumeScale = 1): void {
  const settings = loadSettings()
  const volume = Math.max(0, Math.min(1, settings.masterVolume * settings.sfxVolume * volumeScale))
  if (volume <= 0.01) return
  if (!scene.sound.get(SFX[key])) return
  scene.sound.play(SFX[key], { volume })
}
