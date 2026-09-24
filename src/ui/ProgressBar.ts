import Phaser from 'phaser'
import { COLOR, FONT_SIZE, centerText, textStyle } from './theme'

export interface ProgressBarConfig {
  x: number
  y: number
  width: number
  height?: number
  value?: number
  showPercent?: boolean
}

export class ProgressBar extends Phaser.GameObjects.Container {
  private readonly fill: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text | null
  private readonly boxWidth: number
  private readonly boxHeight: number
  private value: number

  constructor(scene: Phaser.Scene, config: ProgressBarConfig) {
    super(scene, Math.round(config.x), Math.round(config.y))
    this.boxWidth = Math.round(config.width)
    this.boxHeight = Math.round(config.height ?? 18)
    this.value = Phaser.Math.Clamp(config.value ?? 0, 0, 1)

    const bg = scene.add.graphics()
    const halfW = this.boxWidth / 2
    const halfH = this.boxHeight / 2
    bg.fillStyle(COLOR.panelDeep, 1)
    bg.fillRect(-halfW, -halfH, this.boxWidth, this.boxHeight)
    bg.lineStyle(2, COLOR.border, 1)
    bg.strokeRect(-halfW, -halfH, this.boxWidth, this.boxHeight)
    this.add(bg)

    this.fill = scene.add.graphics()
    this.add(this.fill)

    this.label = config.showPercent
      ? scene.add.text(0, 0, '0%', textStyle(FONT_SIZE.sm, COLOR.text))
      : null
    if (this.label) {
      centerText(this.label, 0, 0)
      this.add(this.label)
    }

    this.redraw()
    scene.add.existing(this)
  }

  setValue(value: number): this {
    this.value = Phaser.Math.Clamp(value, 0, 1)
    this.redraw()
    return this
  }

  getValue(): number {
    return this.value
  }

  private redraw(): void {
    const halfW = this.boxWidth / 2
    const halfH = this.boxHeight / 2
    const inner = Math.round((this.boxWidth - 6) * this.value)
    this.fill.clear()
    if (inner > 0) {
      this.fill.fillStyle(COLOR.good, 1)
      this.fill.fillRect(-halfW + 3, -halfH + 3, inner, this.boxHeight - 6)
    }
    this.label?.setText(`${Math.round(this.value * 100)}%`)
  }
}
