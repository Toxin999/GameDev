import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    const { width, height } = this.scale

    this.add
      .text(width / 2, height / 2 - 40, 'INDIE STUDIO SIM', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#f4d35e',
      })
      .setOrigin(0.5)

    this.add
      .text(
        width / 2,
        height / 2 + 24,
        `M0 scaffold ok — Phaser ${Phaser.VERSION} (${this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'})`,
        {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#8aa1b1',
        },
      )
      .setOrigin(0.5)
  }
}
