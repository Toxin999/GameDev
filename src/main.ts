import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'

export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  backgroundColor: '#14151f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene],
})
