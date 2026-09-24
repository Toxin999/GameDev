import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import type { Sim } from '../engine/sim'
import { companyValue, findGenre, findPlatform, findTopic } from '../engine/sim'
import { getSession, startNewSession } from '../game/session'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { addOverlayHeader, COLOR, FONT_SIZE, centerText, textStyle } from '../ui/theme'

const CHART = { x: 300, y: 470, width: 680, height: 120 }

export class ReportScene extends Phaser.Scene {
  private sim!: Sim
  private index = 0
  private subtitleText!: Phaser.GameObjects.Text
  private statsText!: Phaser.GameObjects.Text
  private chart!: Phaser.GameObjects.Graphics
  private chartLabel!: Phaser.GameObjects.Text
  private previousButton!: Button
  private nextButton!: Button

  constructor() {
    super('Report')
  }

  create(data: { index?: number }): void {
    this.sim = getSession() ?? startNewSession('report')
    this.index = Phaser.Math.Clamp(data.index ?? this.sim.state.released.length - 1, 0, Math.max(0, this.sim.state.released.length - 1))

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR.overlay, 0.8).setOrigin(0, 0)
    dim.setInteractive()

    addOverlayHeader(this, 'RELEASE REPORT')
    new Panel(this, { x: GAME_WIDTH / 2, y: 380, width: 900, height: 520 })

    this.subtitleText = this.add.text(0, 0, '', textStyle(FONT_SIZE.md, COLOR.accentCss, true))
    centerText(this.subtitleText, GAME_WIDTH / 2, 150)

    this.statsText = this.add.text(300, 190, '', { ...textStyle(FONT_SIZE.sm, COLOR.text), lineSpacing: 10 })

    this.chart = this.add.graphics()
    this.chartLabel = this.add.text(CHART.x, CHART.y - 26, 'UNITS PER WEEK', textStyle(FONT_SIZE.sm, COLOR.textDim))

    this.previousButton = new Button(this, {
      x: 420,
      y: 620,
      width: 200,
      height: 48,
      label: 'PREVIOUS',
      onClick: () => this.show(this.index - 1),
    })

    this.nextButton = new Button(this, {
      x: 640,
      y: 620,
      width: 200,
      height: 48,
      label: 'NEXT',
      onClick: () => this.show(this.index + 1),
    })

    new Button(this, {
      x: 880,
      y: 620,
      width: 220,
      height: 48,
      label: 'CLOSE',
      style: 'primary',
      onClick: () => this.close(),
    })

    this.input.keyboard?.on('keydown-ESC', () => this.close())
    this.refresh()
  }

  private show(index: number): void {
    this.index = index
    this.refresh()
  }

  private refresh(): void {
    const released = this.sim.state.released
    const game = released[this.index]
    this.previousButton.setEnabled(this.index > 0)
    this.nextButton.setEnabled(this.index < released.length - 1)

    if (!game) {
      this.subtitleText.setText('NO RELEASES YET')
      this.statsText.setText('')
      this.chart.clear()
      this.chartLabel.setText('')
      return
    }

    const topic = findTopic(this.sim.content, game.topicId)
    const genre = findGenre(this.sim.content, game.genreId)
    const platform = findPlatform(this.sim.content, game.platformId)
    this.subtitleText.setText(`${topic.name.toUpperCase()} ${genre.name.toUpperCase()} · ${platform.name.toUpperCase()}`)

    const fansGained = Math.round(game.unitsSold * this.sim.content.balance.fanConversion)
    this.statsText.setText(
      [
        `REVIEW        ${game.review.overall.toFixed(1)} / 10`,
        `UNITS SOLD    ${game.unitsSold.toLocaleString('en-US')}`,
        `REVENUE       $${game.revenue.toLocaleString('en-US')}`,
        `FANS GAINED   ${fansGained.toLocaleString('en-US')}`,
        `STUDIO VALUE  $${companyValue(this.sim).toLocaleString('en-US')}`,
        `RELEASED      WEEK ${game.releaseWeek}`,
      ].join('\n'),
    )

    this.drawChart(game.weeklyUnits)
  }

  private drawChart(weeklyUnits: number[]): void {
    this.chart.clear()
    if (weeklyUnits.length === 0) {
      this.chartLabel.setText('')
      return
    }

    const max = Math.max(...weeklyUnits, 1)
    const barWidth = Math.floor(CHART.width / weeklyUnits.length) - 8
    const chartBottom = CHART.y + CHART.height

    this.chart.lineStyle(2, COLOR.border, 1)
    this.chart.strokeRect(CHART.x, CHART.y, CHART.width, CHART.height)

    weeklyUnits.forEach((units, index) => {
      const height = Math.round((units / max) * (CHART.height - 16))
      const x = CHART.x + 8 + index * (barWidth + 8)
      const y = chartBottom - 8 - height
      this.chart.fillStyle(index === 0 ? COLOR.accent : COLOR.good, 1)
      this.chart.fillRect(x, y, barWidth, height)
    })

    this.chartLabel.setText(`UNITS PER WEEK · PEAK ${max.toLocaleString('en-US')}`)
  }

  private close(): void {
    this.scene.stop()
    this.scene.resume('Office')
  }
}
