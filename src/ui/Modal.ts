import Phaser from 'phaser'
import { Button } from './Button'
import type { ButtonStyle } from './Button'
import { Panel } from './Panel'
import { COLOR, FONT_SIZE, centerText, textStyle } from './theme'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'

export interface ModalButton {
  label: string
  value: string
  style?: ButtonStyle
}

export interface ModalConfig {
  title?: string
  message: string
  buttons?: ModalButton[]
  width?: number
}

export function openModal(scene: Phaser.Scene, config: ModalConfig): Promise<string> {
  const width = config.width ?? 560
  const buttons: ModalButton[] = config.buttons ?? [{ label: 'OK', value: 'ok', style: 'primary' }]

  return new Promise((resolve) => {
    const container = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(1000)

    const dim = scene.add.rectangle(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLOR.overlay, 0.65)
    dim.setOrigin(0, 0)
    container.add(dim)

    const message = scene.add.text(0, 0, config.message, {
      ...textStyle(FONT_SIZE.sm, COLOR.text),
      wordWrap: { width: width - 64 },
      align: 'center',
    })
    centerText(message, 0, 0)

    const buttonHeight = 44
    const topSpace = config.title ? 88 : 56
    const height = Math.round(topSpace + message.height + 40 + buttonHeight)

    const panel = new Panel(scene, { x: 0, y: 0, width, height, title: config.title })
    container.add(panel)

    message.setY(Math.round(panel.top + topSpace + message.height / 2))
    container.add(message)

    const spacing = 16
    const totalButtonWidth = buttons.reduce((sum, b) => sum + Math.max(160, b.label.length * 14 + 40), 0) + spacing * (buttons.length - 1)
    let cursor = Math.round(-totalButtonWidth / 2)
    for (const [index, buttonConfig] of buttons.entries()) {
      const buttonWidth = Math.max(160, buttonConfig.label.length * 14 + 40)
      const button = new Button(scene, {
        x: cursor + buttonWidth / 2,
        y: panel.bottom - 34,
        width: buttonWidth,
        height: buttonHeight,
        label: buttonConfig.label,
        style: buttonConfig.style ?? (index === 0 ? 'primary' : 'default'),
        onClick: () => {
          container.destroy()
          resolve(buttonConfig.value)
        },
      })
      container.add(button)
      cursor += buttonWidth + spacing
    }

    for (const child of container.list) {
      if (child instanceof Phaser.GameObjects.Container) child.setDepth(0)
    }
  })
}
