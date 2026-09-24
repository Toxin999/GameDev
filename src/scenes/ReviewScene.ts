import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import type { Sim } from '../engine/sim'
import { findGenre, findPlatform, findTopic, fixBug, releaseGame } from '../engine/sim'
import { playSfx } from '../game/audio'
import { getSession, startNewSession } from '../game/session'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { ProgressBar } from '../ui/ProgressBar'
import { COLOR, FONT_SIZE, addOverlayHeader, centerText, rightAlignText, textStyle } from '../ui/theme'

const CATEGORY_ORDER = ['gameplay', 'graphics', 'sound', 'story', 'tech'] as const

export class ReviewScene extends Phaser.Scene {
  private sim!: Sim
  private overallText!: Phaser.GameObjects.Text
  private subtitleText!: Phaser.GameObjects.Text
  private bars: ProgressBar[] = []
  private values: Phaser.GameObjects.Text[] = []
  private bugsText!: Phaser.GameObjects.Text
  private fixButton: Button | null = null

  constructor() {
    super('Review')
  }

  create(): void {
    this.sim = getSession() ?? startNewSession('review')
    this.bars = []
    this.values = []
    this.fixButton = null

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR.overlay, 0.8).setOrigin(0, 0)
    dim.setInteractive()

    addOverlayHeader(this, 'REVIEW')

    new Panel(this, { x: GAME_WIDTH / 2, y: 390, width: 900, height: 540 })

    this.subtitleText = this.add.text(0, 0, '', textStyle(FONT_SIZE.sm, COLOR.textDim))
    centerText(this.subtitleText, GAME_WIDTH / 2, 146)

    this.overallText = this.add.text(0, 0, '', textStyle(FONT_SIZE.xl, COLOR.accentCss, true))
    centerText(this.overallText, GAME_WIDTH / 2, 192)

    CATEGORY_ORDER.forEach((category, index) => {
      const y = 262 + index * 58
      this.add.text(400, Math.round(y - 12), category.toUpperCase(), textStyle(FONT_SIZE.sm, COLOR.text))
      const bar = new ProgressBar(this, { x: 700, y, width: 380, height: 18 })
      const value = this.add.text(0, 0, '', textStyle(FONT_SIZE.sm, COLOR.text))
      rightAlignText(value, 960, Math.round(y - 12))
      this.bars.push(bar)
      this.values.push(value)
    })

    this.bugsText = this.add.text(0, 0, '', { ...textStyle(FONT_SIZE.sm, COLOR.textDim), align: 'center' })
    centerText(this.bugsText, GAME_WIDTH / 2, 566)

    this.fixButton = new Button(this, {
      x: 520,
      y: 628,
      width: 300,
      height: 48,
      label: 'FIX BUG',
      onClick: () => this.fix(),
    })

    new Button(this, {
      x: 810,
      y: 628,
      width: 260,
      height: 48,
      label: 'SHIP IT',
      style: 'primary',
      onClick: () => this.ship(),
    })

    this.refresh()
  }

  private refresh(): void {
    const review = this.sim.state.currentReview
    const project = this.sim.state.project
    if (!review || !project) {
      this.close()
      return
    }

    const topic = findTopic(this.sim.content, project.topicId)
    const genre = findGenre(this.sim.content, project.genreId)
    const platform = findPlatform(this.sim.content, project.platformId)

    this.subtitleText.setText(`${topic.name.toUpperCase()} ${genre.name.toUpperCase()} ON ${platform.name.toUpperCase()}`)
    this.overallText.setText(`${review.overall.toFixed(1)} / 10`)

    CATEGORY_ORDER.forEach((category, index) => {
      const score = review.categories[category]
      this.bars[index]!.setValue(score / this.sim.content.balance.maxScore)
      this.values[index]!.setText(score.toFixed(1))
    })

    this.bugsText.setText(
      project.bugs > 0
        ? `${project.bugs} BUGS LEFT · FIXING COSTS $${this.sim.content.balance.fixBugCost} AND ONE WEEK`
        : 'NO BUGS · READY TO SHIP',
    )

    this.fixButton?.setEnabled(project.bugs > 0)
    this.fixButton?.setLabel(project.bugs > 0 ? `FIX BUG (${project.bugs})` : 'NO BUGS')
  }

  private fix(): void {
    try {
      fixBug(this.sim)
      playSfx(this, 'select')
    } catch (error) {
      playSfx(this, 'error')
      this.bugsText.setText((error as Error).message.toUpperCase())
    }
    this.refresh()
  }

  private ship(): void {
    releaseGame(this.sim)
    playSfx(this, 'success')
    this.close()
  }

  private close(): void {
    this.scene.stop()
    this.scene.resume('Office')
  }
}
