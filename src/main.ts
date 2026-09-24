import Phaser from 'phaser'
import './style.css'
import { GAME_HEIGHT, GAME_WIDTH } from './config'
import { BootScene } from './scenes/BootScene'
import { DevSandboxScene } from './scenes/DevSandboxScene'
import { MainMenuScene } from './scenes/MainMenuScene'
import { SettingsScene } from './scenes/SettingsScene'

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
  scene: [BootScene, MainMenuScene, SettingsScene, DevSandboxScene],
})
