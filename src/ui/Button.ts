import Phaser from 'phaser'
import { playSfx } from '../game/audio'
import { COLOR, FONT_SIZE, centerText, rectHitArea, textStyle } from './theme'

export type ButtonStyle = 'default' | 'primary' | 'danger'

export interface ButtonConfig {
  x: number
  y: number
  width: number
  height?: number
  label: string
  style?: ButtonStyle
  fontSize?: number
  onClick?: () => void
}

interface Palette {
  fill: number
  hover: number
  pressed: number
  border: number
  label: string
  disabledFill: number
}

const PALETTES: Record<ButtonStyle, Palette> = {
  default: {
    fill: COLOR.panelAlt,
    hover: COLOR.defaultHover,
    pressed: COLOR.defaultPressed,
    border: COLOR.border,
    label: COLOR.text,
    disabledFill: COLOR.panelDeep,
  },
  primary: {
    fill: COLOR.primary,
    hover: COLOR.primaryHover,
    pressed: COLOR.primaryPressed,
    border: COLOR.good,
    label: COLOR.primaryCss,
    disabledFill: COLOR.panelDeep,
  },
  danger: {
    fill: 0x6b3a3a,
    hover: 0x855050,
    pressed: 0x9a5d5d,
    border: COLOR.danger,
    label: COLOR.text,
    disabledFill: COLOR.panelDeep,
  },
}

export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics
  private readonly labelText: Phaser.GameObjects.Text
  private readonly palette: Palette
  private readonly boxWidth: number
  private readonly boxHeight: number
  private isEnabled = true
  private isSelected = false
  private hovered = false
  private pressed = false
  private onClick?: () => void

  constructor(scene: Phaser.Scene, config: ButtonConfig) {
    super(scene, Math.round(config.x), Math.round(config.y))
    this.palette = PALETTES[config.style ?? 'default']
    this.boxWidth = Math.round(config.width)
    this.boxHeight = Math.round(config.height ?? 40)
    this.onClick = config.onClick

    this.bg = scene.add.graphics()
    this.labelText = scene.add.text(0, 0, config.label, textStyle(config.fontSize ?? FONT_SIZE.sm, this.palette.label))
    centerText(this.labelText, 0, 0)
    this.add([this.bg, this.labelText])

    this.enableInput()

    this.on('pointerover', () => {
      this.hovered = true
      this.redraw()
    })
    this.on('pointerout', () => {
      this.hovered = false
      this.pressed = false
      this.redraw()
    })
    this.on('pointerdown', () => {
      if (!this.isEnabled) return
      this.pressed = true
      this.redraw()
    })
    this.on('pointerup', () => {
      if (!this.isEnabled || !this.pressed) return
      this.pressed = false
      this.redraw()
      playSfx(this.scene, 'click')
      this.onClick?.()
    })

    this.redraw()
    scene.add.existing(this)
  }

  setLabel(label: string): this {
    this.labelText.setText(label)
    centerText(this.labelText, 0, 0)
    return this
  }

  setEnabled(enabled: boolean): this {
    this.isEnabled = enabled
    if (enabled) this.enableInput()
    else this.disableInteractive()
    this.redraw()
    return this
  }

  setSelected(selected: boolean): this {
    this.isSelected = selected
    this.redraw()
    return this
  }

  setOnClick(onClick: () => void): this {
    this.onClick = onClick
    return this
  }

  activate(): void {
    if (this.isEnabled) this.onClick?.()
  }

  private enableInput(): void {
    this.setInteractive({
      hitArea: rectHitArea(-this.boxWidth / 2, -this.boxHeight / 2, this.boxWidth, this.boxHeight),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    })
  }

  private redraw(): void {
    let fill = this.palette.fill
    if (!this.isEnabled) fill = this.palette.disabledFill
    else if (this.pressed) fill = this.palette.pressed
    else if (this.hovered || this.isSelected) fill = this.palette.hover

    const halfW = this.boxWidth / 2
    const halfH = this.boxHeight / 2
    this.bg.clear()
    this.bg.fillStyle(fill, 1)
    this.bg.fillRect(-halfW, -halfH, this.boxWidth, this.boxHeight)
    this.bg.lineStyle(2, this.isSelected ? COLOR.accent : this.palette.border, 1)
    this.bg.strokeRect(-halfW, -halfH, this.boxWidth, this.boxHeight)
    this.setAlpha(this.isEnabled ? 1 : 0.55)
  }
}
