import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import { loadSettings, saveSettings } from '../game/session'
import type { Settings } from '../game/session'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { Slider } from '../ui/Slider'
import { COLOR, FONT_SIZE, centerText, textStyle } from '../ui/theme'

export class SettingsScene extends Phaser.Scene {
  private settings: Settings = loadSettings()
  private returnScene = 'MainMenu'
  private fullscreenButton!: Button

  constructor() {
    super('Settings')
  }

  create(data: { returnScene?: string }): void {
    this.returnScene = data.returnScene ?? 'MainMenu'
    this.settings = loadSettings()

    const centerX = GAME_WIDTH / 2
    const centerY = GAME_HEIGHT / 2

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR.overlay, 0.65)
    dim.setOrigin(0, 0)
    dim.setInteractive()

    new Panel(this, { x: centerX, y: centerY, width: 680, height: 480, title: 'SETTINGS' })

    new Slider(this, {
      x: centerX,
      y: centerY - 96,
      width: 520,
      min: 0,
      max: 100,
      step: 5,
      value: Math.round(this.settings.masterVolume * 100),
      label: 'MASTER VOLUME',
      format: (value) => `${value}%`,
      onChange: (value) => {
        this.settings.masterVolume = value / 100
        saveSettings(this.settings)
      },
    })

    new Slider(this, {
      x: centerX,
      y: centerY - 16,
      width: 520,
      min: 0,
      max: 100,
      step: 5,
      value: Math.round(this.settings.sfxVolume * 100),
      label: 'SFX VOLUME',
      format: (value) => `${value}%`,
      onChange: (value) => {
        this.settings.sfxVolume = value / 100
        saveSettings(this.settings)
      },
    })

    this.fullscreenButton = new Button(this, {
      x: centerX,
      y: centerY + 76,
      width: 360,
      height: 48,
      label: this.fullscreenLabel(),
      onClick: () => {
        this.scale.toggleFullscreen()
        this.time.delayedCall(50, () => this.fullscreenButton.setLabel(this.fullscreenLabel()))
      },
    })

    new Button(this, {
      x: centerX,
      y: centerY + 156,
      width: 260,
      height: 52,
      label: 'BACK',
      style: 'primary',
      onClick: () => this.close(),
    })

    const hint = this.add.text(0, 0, 'ESC TO CLOSE', textStyle(FONT_SIZE.sm, COLOR.textDim))
    centerText(hint, centerX, centerY + 212)

    this.input.keyboard?.on('keydown-ESC', () => this.close())
  }

  private fullscreenLabel(): string {
    return this.scale.isFullscreen ? 'FULLSCREEN: ON' : 'FULLSCREEN: OFF'
  }

  private close(): void {
    this.scene.stop()
    this.scene.resume(this.returnScene)
  }
}
