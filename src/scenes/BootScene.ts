import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import { COLOR, FONT_FAMILY, FONT_SIZE, centerText, textStyle } from '../ui/theme'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor(COLOR.bg)
    const label = this.add.text(0, 0, 'loading', textStyle(FONT_SIZE.sm, COLOR.textDim))
    centerText(label, GAME_WIDTH / 2, GAME_HEIGHT / 2)

    try {
      await Promise.all([
        document.fonts.load(`16px "${FONT_FAMILY}"`),
        document.fonts.load(`bold 16px "${FONT_FAMILY}"`),
      ])
    } catch {
      label.setText('font unavailable')
    }

    const requested = new URLSearchParams(window.location.search).get('scene')
    const target = requested && this.scene.manager.keys[requested] ? requested : 'MainMenu'
    this.scene.start(target)
  }
}
