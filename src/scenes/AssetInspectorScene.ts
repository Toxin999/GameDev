import Phaser from 'phaser'
import { SPRITE_SCALE } from '../game/officeLayout'
import { COLOR, FONT_SIZE, textStyle } from '../ui/theme'

const SHEETS: Array<{ key: string; columns: number; frames: number }> = [
  { key: 'furniture', columns: 8, frames: 32 },
  { key: 'walls', columns: 8, frames: 40 },
]

export class AssetInspectorScene extends Phaser.Scene {
  constructor() {
    super('AssetInspector')
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLOR.bg)
    this.add.text(16, 12, 'ASSET INSPECTOR — ?sheet=furniture|walls', textStyle(FONT_SIZE.sm, COLOR.accentCss))

    const cell = 16 * SPRITE_SCALE + 28
    let originY = 70

    for (const sheet of SHEETS) {
      this.add.text(16, originY - 26, sheet.key.toUpperCase(), textStyle(FONT_SIZE.sm, COLOR.textDim))
      const rows = Math.ceil(sheet.frames / sheet.columns)
      for (let index = 0; index < sheet.frames; index++) {
        const col = index % sheet.columns
        const row = Math.floor(index / sheet.columns)
        const x = 48 + col * cell
        const y = originY + row * cell
        this.add.image(x, y, sheet.key, index).setScale(SPRITE_SCALE).setOrigin(0.5, 0.5)
        this.add.text(Math.round(x - 12), Math.round(y + 26), String(index), textStyle(10, COLOR.textDim))
      }
      originY += rows * cell + 60
    }
  }
}
