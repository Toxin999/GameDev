import Phaser from 'phaser'
import { GAME_WIDTH } from '../config'
import type { Sim } from '../engine/sim'
import { companyValue } from '../engine/sim'
import type { LeaderboardEntry } from '../game/cloud'
import { fetchLeaderboard, getStudioName, submitScore } from '../game/cloud'
import { getSession } from '../game/session'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { addOverlayHeader, COLOR, FONT_SIZE, rightAlignText, textStyle } from '../ui/theme'

const ROW_COUNT = 10
const ROW_HEIGHT = 38
const COLUMN = { rank: 300, name: 380, value: 880, detail: 920 }

export class LeaderboardScene extends Phaser.Scene {
  private rowTexts: Phaser.GameObjects.Text[] = []
  private statusText!: Phaser.GameObjects.Text
  private submitButton!: Button
  private busy = false

  constructor() {
    super('Leaderboard')
  }

  create(): void {
    this.rowTexts = []
    this.busy = false
    this.cameras.main.setBackgroundColor(COLOR.bg)

    addOverlayHeader(this, 'LEADERBOARD')
    new Panel(this, { x: GAME_WIDTH / 2, y: 380, width: 900, height: 560 })

    const header = textStyle(FONT_SIZE.sm, COLOR.textDim)
    this.add.text(COLUMN.rank, 132, 'RANK', header)
    this.add.text(COLUMN.name, 132, 'STUDIO', header)
    const valueHeader = this.add.text(0, 132, 'VALUE', header)
    rightAlignText(valueHeader, COLUMN.value, 132)
    this.add.text(COLUMN.detail, 132, 'RELEASES / WEEKS', header)

    this.statusText = this.add.text(COLUMN.rank, 590, 'LOADING...', textStyle(FONT_SIZE.sm, COLOR.accentCss))

    this.submitButton = new Button(this, {
      x: 790,
      y: 640,
      width: 280,
      height: 48,
      label: 'SUBMIT MY SCORE',
      style: 'primary',
      onClick: () => void this.submit(),
    })

    new Button(this, {
      x: 500,
      y: 640,
      width: 220,
      height: 48,
      label: 'BACK',
      onClick: () => this.scene.start('MainMenu'),
    })

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MainMenu'))
    this.submitButton.setEnabled(this.scoreableSession() !== null)
    void this.refresh()
  }

  private scoreableSession(): Sim | null {
    const sim = getSession()
    return sim && sim.state.released.length > 0 ? sim : null
  }

  private async submit(): Promise<void> {
    const sim = this.scoreableSession()
    if (!sim || this.busy) return
    this.busy = true
    this.submitButton.setEnabled(false)
    this.statusText.setText('SUBMITTING...')
    const rank = await submitScore(sim)
    this.busy = false
    this.submitButton.setEnabled(true)
    await this.refresh()
    if (rank) this.statusText.setText(`${getStudioName()} IS NOW RANK #${rank}`)
  }

  private clearRows(): void {
    for (const text of this.rowTexts) text.destroy()
    this.rowTexts = []
  }

  private drawRow(entry: LeaderboardEntry, index: number): void {
    const y = 176 + index * ROW_HEIGHT
    const style = textStyle(FONT_SIZE.sm, COLOR.text)
    const rank = this.add.text(COLUMN.rank, y, `${entry.rank}`.padStart(2, '0'), style)
    const name = this.add.text(COLUMN.name, y, entry.name, style)
    const value = this.add.text(0, y, `$${entry.companyValue.toLocaleString('en-US')}`, textStyle(FONT_SIZE.sm, COLOR.moneyCss))
    rightAlignText(value, COLUMN.value, y)
    const detail = this.add.text(COLUMN.detail, y, `${entry.gamesReleased}G · ${entry.weeks}W`, textStyle(FONT_SIZE.sm, COLOR.textDim))
    this.rowTexts.push(rank, name, value, detail)
  }

  private async refresh(): Promise<void> {
    this.clearRows()
    this.statusText.setText('LOADING...')

    try {
      const entries = await fetchLeaderboard(ROW_COUNT)
      if (!this.scene.isActive()) return

      if (!entries) {
        this.statusText.setText('LEADERBOARD UNAVAILABLE · CHECK YOUR CONNECTION')
        return
      }

      entries.slice(0, ROW_COUNT).forEach((entry, index) => this.drawRow(entry, index))

      const sim = this.scoreableSession()
      const mine = sim ? `YOUR VALUE $${companyValue(sim).toLocaleString('en-US')}` : 'NO RELEASES YET'
      this.statusText.setText(entries.length === 0 ? `NO SCORES YET · ${mine}` : `${getStudioName()} · ${mine}`)
    } catch (error) {
      this.statusText.setText(`LEADERBOARD ERROR · ${(error as Error).message.toUpperCase()}`)
    }
  }
}
