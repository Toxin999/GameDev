import Phaser from 'phaser'
import { Button } from './Button'
import { COLOR, FONT_SIZE, centerText, rectHitArea, textStyle } from './theme'

export interface ScrollListConfig<T> {
  x: number
  y: number
  width: number
  height: number
  items: T[]
  render: (item: T, index: number) => string
  onSelect?: (item: T, index: number) => void
  onHighlight?: (item: T, index: number) => void
  itemHeight?: number
  fontSize?: number
}

export class ScrollList<T> extends Phaser.GameObjects.Container {
  private readonly config: ScrollListConfig<T>
  private readonly boxWidth: number
  private readonly boxHeight: number
  private readonly itemHeight: number
  private readonly viewportCount: number
  private readonly emptyLabel: Phaser.GameObjects.Text
  private items: T[] = []
  private itemButtons: Button[] = []
  private selectedIndex = 0
  private scrollOffset = 0

  constructor(scene: Phaser.Scene, config: ScrollListConfig<T>) {
    super(scene, Math.round(config.x), Math.round(config.y))
    this.config = config
    this.boxWidth = Math.round(config.width)
    this.boxHeight = Math.round(config.height)
    this.itemHeight = Math.round(config.itemHeight ?? 32)
    this.viewportCount = Math.max(1, Math.floor((this.boxHeight - 8) / this.itemHeight))

    const halfW = this.boxWidth / 2
    const halfH = this.boxHeight / 2
    const bg = scene.add.graphics()
    bg.fillStyle(COLOR.panelDeep, 1)
    bg.fillRect(-halfW, -halfH, this.boxWidth, this.boxHeight)
    bg.lineStyle(2, COLOR.border, 1)
    bg.strokeRect(-halfW, -halfH, this.boxWidth, this.boxHeight)
    this.add(bg)

    this.emptyLabel = scene.add.text(0, 0, 'no entries', textStyle(FONT_SIZE.sm, COLOR.textDim))
    centerText(this.emptyLabel, 0, 0)
    this.add(this.emptyLabel)

    this.setInteractive({
      hitArea: rectHitArea(-halfW, -halfH, this.boxWidth, this.boxHeight),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    })
    scene.input.on('wheel', this.onWheel, this)
    this.once('destroy', () => scene.input.off('wheel', this.onWheel, this))

    this.setItems(config.items)
    scene.add.existing(this)
  }

  private onWheel(_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[], _dx: number, dy: number): void {
    if (!over.includes(this)) return
    this.scroll(dy > 0 ? 1 : -1)
  }

  setItems(items: T[]): void {
    this.items = items
    this.selectedIndex = 0
    this.scrollOffset = 0
    this.rebuild(false)
  }

  getSelected(): T | null {
    return this.items[this.selectedIndex] ?? null
  }

  getSelectedIndex(): number {
    return this.selectedIndex
  }

  setSelectedIndex(index: number, emit = false): void {
    if (this.items.length === 0) return
    const next = Phaser.Math.Clamp(index, 0, this.items.length - 1)
    this.selectedIndex = next
    this.ensureVisible()
    this.rebuild(emit)
  }

  moveSelection(delta: number): void {
    this.setSelectedIndex(this.selectedIndex + delta, false)
    const item = this.getSelected()
    if (item !== null) this.config.onHighlight?.(item, this.selectedIndex)
  }

  confirmSelection(): void {
    const item = this.getSelected()
    if (item !== null) this.config.onSelect?.(item, this.selectedIndex)
  }

  private scroll(delta: number): void {
    const maxOffset = Math.max(0, this.items.length - this.viewportCount)
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + delta, 0, maxOffset)
    this.rebuild(false)
  }

  private ensureVisible(): void {
    if (this.selectedIndex < this.scrollOffset) this.scrollOffset = this.selectedIndex
    const lastVisible = this.scrollOffset + this.viewportCount - 1
    if (this.selectedIndex > lastVisible) this.scrollOffset = this.selectedIndex - this.viewportCount + 1
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, Math.max(0, this.items.length - this.viewportCount))
  }

  private rebuild(emit: boolean): void {
    for (const button of this.itemButtons) button.destroy()
    this.itemButtons = []
    this.emptyLabel.setVisible(this.items.length === 0)

    const halfH = this.boxHeight / 2
    const end = Math.min(this.items.length, this.scrollOffset + this.viewportCount)
    for (let index = this.scrollOffset; index < end; index++) {
      const item = this.items[index]!
      const y = Math.round(-halfH + 4 + this.itemHeight / 2 + (index - this.scrollOffset) * this.itemHeight)
      const button = new Button(this.scene, {
        x: 0,
        y,
        width: this.boxWidth - 8,
        height: this.itemHeight - 4,
        label: this.config.render(item, index),
        fontSize: this.config.fontSize ?? FONT_SIZE.sm,
        onClick: () => this.setSelectedIndex(index, true),
      })
      button.setSelected(index === this.selectedIndex)
      this.itemButtons.push(button)
      this.add(button)
    }

    if (emit) {
      const item = this.getSelected()
      if (item !== null) this.config.onSelect?.(item, this.selectedIndex)
    }
  }
}
