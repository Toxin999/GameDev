import Phaser from 'phaser'
import { COLOR, FONT_SIZE, rectHitArea, rightAlignText, textStyle } from './theme'
import { normalizeValue, ratioToValue, valueToRatio } from './sliderMath'

export interface SliderConfig {
  x: number
  y: number
  width: number
  min: number
  max: number
  step: number
  value: number
  label?: string
  format?: (value: number) => string
  onChange?: (value: number) => void
}

export class Slider extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Graphics
  private readonly knob: Phaser.GameObjects.Graphics
  private readonly labelText: Phaser.GameObjects.Text | null
  private readonly valueText: Phaser.GameObjects.Text
  private readonly boxWidth: number
  private readonly config: SliderConfig
  private value: number
  private dragging = false

  constructor(scene: Phaser.Scene, config: SliderConfig) {
    super(scene, Math.round(config.x), Math.round(config.y))
    this.config = config
    this.boxWidth = Math.round(config.width)
    this.value = normalizeValue(config.value, config.min, config.max, config.step)

    this.track = scene.add.graphics()
    this.knob = scene.add.graphics()
    this.add([this.track, this.knob])

    const top = -40
    if (config.label) {
      this.labelText = scene.add.text(Math.round(-this.boxWidth / 2), top, config.label, textStyle(FONT_SIZE.sm, COLOR.textDim))
      this.add(this.labelText)
    } else {
      this.labelText = null
    }

    this.valueText = scene.add.text(0, top, this.formatValue(this.value), textStyle(FONT_SIZE.sm, COLOR.accentCss))
    rightAlignText(this.valueText, this.boxWidth / 2, top)
    this.add(this.valueText)

    this.setInteractive({
      hitArea: rectHitArea(-this.boxWidth / 2, -16, this.boxWidth, 32),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    })
    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = true
      this.updateFromPointer(pointer, true)
    })
    scene.input.on('pointermove', this.onPointerMove, this)
    scene.input.on('pointerup', this.onPointerUp, this)
    this.once('destroy', () => {
      scene.input.off('pointermove', this.onPointerMove, this)
      scene.input.off('pointerup', this.onPointerUp, this)
    })

    this.redraw()
    scene.add.existing(this)
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragging) this.updateFromPointer(pointer, true)
  }

  private onPointerUp(): void {
    this.dragging = false
  }

  private updateFromPointer(pointer: Phaser.Input.Pointer, emit: boolean): void {
    const matrix = this.getWorldTransformMatrix()
    const localX = pointer.worldX - matrix.tx
    const ratio = (localX + this.boxWidth / 2) / this.boxWidth
    this.setValue(ratioToValue(ratio, this.config.min, this.config.max, this.config.step), emit)
  }

  private formatValue(value: number): string {
    return this.config.format ? this.config.format(value) : String(value)
  }

  setValue(value: number, emit = false): this {
    const next = normalizeValue(value, this.config.min, this.config.max, this.config.step)
    const changed = next !== this.value
    this.value = next
    this.redraw()
    if (changed && emit) this.config.onChange?.(next)
    return this
  }

  nudge(direction: number): this {
    return this.setValue(this.value + direction * this.config.step, true)
  }

  getValue(): number {
    return this.value
  }

  private redraw(): void {
    const halfW = this.boxWidth / 2
    const ratio = valueToRatio(this.value, this.config.min, this.config.max)
    const knobX = Math.round(-halfW + ratio * this.boxWidth)

    this.track.clear()
    this.track.fillStyle(COLOR.panelDeep, 1)
    this.track.fillRect(-halfW, -4, this.boxWidth, 8)
    this.track.fillStyle(COLOR.borderBright, 1)
    this.track.fillRect(-halfW, -4, knobX + halfW, 8)
    this.track.lineStyle(2, COLOR.border, 1)
    this.track.strokeRect(-halfW, -4, this.boxWidth, 8)

    this.knob.clear()
    this.knob.fillStyle(this.dragging ? COLOR.accent : COLOR.textFill, 1)
    this.knob.fillRect(knobX - 6, -11, 12, 22)
    this.knob.lineStyle(2, COLOR.accent, 1)
    this.knob.strokeRect(knobX - 6, -11, 12, 22)

    this.valueText.setText(this.formatValue(this.value))
    rightAlignText(this.valueText, halfW, -40)
  }
}
