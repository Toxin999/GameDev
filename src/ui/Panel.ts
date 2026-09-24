import Phaser from 'phaser'
import { COLOR, FONT_SIZE, centerText, textStyle } from './theme'

export interface PanelConfig {
  x: number
  y: number
  width: number
  height: number
  title?: string
  fill?: number
  border?: number
}

export class Panel extends Phaser.GameObjects.Container {
  readonly boxWidth: number
  readonly boxHeight: number

  constructor(scene: Phaser.Scene, config: PanelConfig) {
    super(scene, Math.round(config.x), Math.round(config.y))
    this.boxWidth = Math.round(config.width)
    this.boxHeight = Math.round(config.height)

    const bg = scene.add.graphics()
    const halfW = this.boxWidth / 2
    const halfH = this.boxHeight / 2
    bg.fillStyle(config.fill ?? COLOR.panel, 1)
    bg.fillRect(-halfW, -halfH, this.boxWidth, this.boxHeight)
    bg.lineStyle(2, config.border ?? COLOR.border, 1)
    bg.strokeRect(-halfW, -halfH, this.boxWidth, this.boxHeight)
    this.add(bg)

    if (config.title) {
      const title = scene.add.text(0, 0, config.title, textStyle(FONT_SIZE.md, COLOR.accentCss, true))
      centerText(title, 0, -halfH + 26)
      this.add(title)
    }

    scene.add.existing(this)
  }

  get left(): number {
    return -this.boxWidth / 2
  }

  get top(): number {
    return -this.boxHeight / 2
  }

  get right(): number {
    return this.boxWidth / 2
  }

  get bottom(): number {
    return this.boxHeight / 2
  }
}
