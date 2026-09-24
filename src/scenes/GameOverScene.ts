import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import type { Sim } from '../engine/sim'
import { companyValue, dateOf } from '../engine/sim'
import { getSession, startNewSession } from '../game/session'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { addOverlayHeader, COLOR, FONT_SIZE, centerText, textStyle } from '../ui/theme'

export class GameOverScene extends Phaser.Scene {
  private sim!: Sim

  constructor() {
    super('GameOver')
  }

  create(): void {
    this.sim = getSession() ?? startNewSession('gameover')
    const won = this.sim.state.outcome === 'win'
    const released = this.sim.state.released
    const averageReview = released.length > 0 ? released.reduce((sum, game) => sum + game.review.overall, 0) / released.length : 0
    const lifetimeRevenue = released.reduce((sum, game) => sum + game.revenue, 0)
    const totalUnits = released.reduce((sum, game) => sum + game.unitsSold, 0)
    const date = dateOf(this.sim)

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR.overlay, 0.85).setOrigin(0, 0)
    dim.setInteractive()

    addOverlayHeader(this, won ? 'STUDIO SUCCESS' : 'STUDIO CLOSED')
    new Panel(this, { x: GAME_WIDTH / 2, y: 360, width: 820, height: 500 })

    const headline = this.add.text(0, 0, won ? 'YOU WIN' : 'BANKRUPT', textStyle(FONT_SIZE.xl, won ? COLOR.goodCss : COLOR.dangerCss, true))
    centerText(headline, GAME_WIDTH / 2, 156)

    this.add.text(
      320,
      220,
      [
        `GAMES RELEASED   ${released.length}`,
        `AVERAGE REVIEW   ${released.length > 0 ? averageReview.toFixed(1) : '-'} / 10`,
        `TOTAL UNITS      ${totalUnits.toLocaleString('en-US')}`,
        `LIFETIME REVENUE $${lifetimeRevenue.toLocaleString('en-US')}`,
        `FANS             ${this.sim.state.fans.toLocaleString('en-US')}`,
        `WEEKS PLAYED     ${this.sim.state.week.toLocaleString('en-US')}`,
        `FINAL DATE       ${date.year} M${String(date.month).padStart(2, '0')} W${String(date.week).padStart(2, '0')}`,
        `STUDIO VALUE     $${companyValue(this.sim).toLocaleString('en-US')}`,
      ].join('\n'),
      { ...textStyle(FONT_SIZE.sm, COLOR.text), lineSpacing: 10 },
    )

    new Button(this, {
      x: 520,
      y: 600,
      width: 220,
      height: 52,
      label: 'NEW GAME',
      style: 'primary',
      onClick: () => {
        startNewSession('office')
        this.scene.stop()
        this.scene.start('Office')
      },
    })

    new Button(this, {
      x: 780,
      y: 600,
      width: 220,
      height: 52,
      label: 'MAIN MENU',
      onClick: () => {
        this.scene.stop()
        this.scene.start('MainMenu')
      },
    })
  }
}
