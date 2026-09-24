import Phaser from 'phaser'
import './style.css'
import { GAME_HEIGHT, GAME_WIDTH } from './config'
import { AssetInspectorScene } from './scenes/AssetInspectorScene'
import { BootScene } from './scenes/BootScene'
import { DevSandboxScene } from './scenes/DevSandboxScene'
import { MainMenuScene } from './scenes/MainMenuScene'
import { GameOverScene } from './scenes/GameOverScene'
import { LeaderboardScene } from './scenes/LeaderboardScene'
import { OfficeScene } from './scenes/OfficeScene'
import { ProjectSetupScene } from './scenes/ProjectSetupScene'
import { ReportScene } from './scenes/ReportScene'
import { ResearchScene } from './scenes/ResearchScene'
import { ReviewScene } from './scenes/ReviewScene'
import { SettingsScene } from './scenes/SettingsScene'
import { StaffScene } from './scenes/StaffScene'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#14151f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    MainMenuScene,
    SettingsScene,
    OfficeScene,
    ProjectSetupScene,
    ReviewScene,
    ReportScene,
    ResearchScene,
    StaffScene,
    GameOverScene,
    LeaderboardScene,
    DevSandboxScene,
    AssetInspectorScene,
  ],
})
