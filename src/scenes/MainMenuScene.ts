import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import { hasSession, hasSave, startNewSession } from '../game/session'
import { Button } from '../ui/Button'
import type { ButtonStyle } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { COLOR, FONT_SIZE, centerText, textStyle } from '../ui/theme'

interface MenuItem {
  button: Button
  enabled: boolean
}

interface MenuDefinition {
  label: string
  style: ButtonStyle
  enabled: boolean
  onClick: () => void
}

export class MainMenuScene extends Phaser.Scene {
  private items: MenuItem[] = []
  private selected = 0

  constructor() {
    super('MainMenu')
  }

  create(): void {
    this.items = []
    this.selected = 0

    this.cameras.main.setBackgroundColor(COLOR.bg)
    const title = this.add.text(0, 0, 'INDIE STUDIO SIM', textStyle(FONT_SIZE.xl, COLOR.accentCss, true))
    centerText(title, GAME_WIDTH / 2, 150)
    const subtitle = this.add.text(0, 0, 'BUILD GAMES IN YOUR GARAGE', textStyle(FONT_SIZE.sm, COLOR.textDim))
    centerText(subtitle, GAME_WIDTH / 2, 208)

    new Panel(this, { x: GAME_WIDTH / 2, y: 452, width: 460, height: 344 })

    const definitions: MenuDefinition[] = [
      { label: 'NEW GAME', style: 'primary', enabled: true, onClick: () => this.startNewGame() },
      { label: 'CONTINUE', style: 'default', enabled: hasSave() || hasSession(), onClick: () => this.scene.start('Office') },
      { label: 'LEADERBOARD', style: 'default', enabled: false, onClick: () => undefined },
      { label: 'SETTINGS', style: 'default', enabled: true, onClick: () => this.openSettings() },
    ]

    definitions.forEach((definition, index) => {
      const button = new Button(this, {
        x: GAME_WIDTH / 2,
        y: 340 + index * 68,
        width: 360,
        height: 52,
        label: definition.label,
        style: definition.style,
        onClick: definition.onClick,
      })
      button.setEnabled(definition.enabled)
      this.items.push({ button, enabled: definition.enabled })
    })

    this.updateSelection()

    const keyboard = this.input.keyboard
    keyboard?.on('keydown-UP', () => this.moveSelection(-1))
    keyboard?.on('keydown-DOWN', () => this.moveSelection(1))
    keyboard?.on('keydown-ENTER', () => this.activateSelection())

    const footer = this.add.text(0, 0, 'M2 BUILD', textStyle(FONT_SIZE.sm, COLOR.textDim))
    footer.setPosition(24, GAME_HEIGHT - 40)
  }

  private moveSelection(direction: number): void {
    if (this.items.length === 0) return
    let next = this.selected
    for (let step = 0; step < this.items.length; step++) {
      next = (next + direction + this.items.length) % this.items.length
      if (this.items[next]!.enabled) break
    }
    this.selected = next
    this.updateSelection()
  }

  private activateSelection(): void {
    this.items[this.selected]?.button.activate()
  }

  private updateSelection(): void {
    this.items.forEach((item, index) => item.button.setSelected(index === this.selected && item.enabled))
  }

  private startNewGame(): void {
    startNewSession()
    this.scene.start('Office')
  }

  private openSettings(): void {
    this.scene.launch('Settings', { returnScene: this.scene.key })
    this.scene.pause()
  }
}
