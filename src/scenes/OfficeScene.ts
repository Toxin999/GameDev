import Phaser from 'phaser'
import { GAME_WIDTH } from '../config'
import type { Sim } from '../engine/sim'
import { availablePlatforms, dateOf, fixBug, projectProgress, releaseGame, startProject, tick } from '../engine/sim'
import { allocateSliders } from '../game/allocate'
import {
  CHAR_COLUMNS,
  CHAR_DIR_COLUMN,
  DESK_SPOT,
  DESK_X,
  DESK_Y,
  FLOOR_TOP,
  FURNITURE,
  ROOM,
  SPRITE_SCALE,
  TILE,
  WALK_SPEED,
  WALL_ROWS,
  WALL_TILES,
  WAYPOINTS,
} from '../game/officeLayout'
import type { Direction } from '../game/officeLayout'
import { getSession, startNewSession } from '../game/session'
import { Button } from '../ui/Button'
import { openModal } from '../ui/Modal'
import { ProgressBar } from '../ui/ProgressBar'
import { COLOR, FONT_SIZE, centerText, textStyle } from '../ui/theme'

const TICK_MS = 1100
const CHAR_INDEX = 0
const FLOOR_BOTTOM = ROOM.y + ROOM.rows * TILE
const PHASE_LABELS: Record<string, string> = {
  idle: 'IDLE',
  dev: 'DEVELOPING',
  release: 'READY TO SHIP',
  sales: 'ON SALE',
  over: 'FINISHED',
}
const ACTION_LABELS: Record<string, string> = {
  idle: 'NEW PROJECT',
  dev: 'DEVELOPING',
  release: 'SHIP IT!',
  sales: 'ON SALE',
  over: 'NEW GAME',
}

interface Placement {
  sheet: string
  frame: number
  col: number
  row: number
}

const FURNITURE_PLACEMENTS: Placement[] = [
  { ...FURNITURE.shelf, col: 2, row: 2 },
  { ...FURNITURE.cooler, col: 18, row: 2 },
  { ...FURNITURE.cabinet, col: 16, row: 2 },
  { ...FURNITURE.plant, col: 1, row: 8 },
  { ...FURNITURE.plantFlower, col: 18, row: 8 },
  { ...FURNITURE.sofa, col: 4, row: 8 },
  { ...FURNITURE.rugLeft, col: 8, row: 7 },
  { ...FURNITURE.rugRight, col: 9, row: 7 },
  { ...FURNITURE.desk, col: 12, row: 5 },
  { ...FURNITURE.desk, col: 13, row: 5 },
]

export class OfficeScene extends Phaser.Scene {
  private sim!: Sim
  private dev!: Phaser.GameObjects.Sprite
  private facing: Direction = 'down'
  private moveTween: Phaser.Tweens.Tween | null = null
  private wanderTimer: Phaser.Time.TimerEvent | null = null
  private moneyText!: Phaser.GameObjects.Text
  private dateText!: Phaser.GameObjects.Text
  private fansText!: Phaser.GameObjects.Text
  private phaseText!: Phaser.GameObjects.Text
  private actionButton!: Button
  private progressBar!: ProgressBar
  private progressLabel!: Phaser.GameObjects.Text
  private lastPhase = ''

  constructor() {
    super('Office')
  }

  create(): void {
    this.sim = getSession() ?? startNewSession('office')
    this.lastPhase = ''
    this.moveTween = null
    this.wanderTimer = null

    this.createAnimations()
    this.drawRoom()
    this.placeFurniture()
    this.createDev()
    this.createProgress()
    this.createHud()

    this.time.addEvent({ delay: TICK_MS, loop: true, callback: () => this.clock() })
    this.refresh()
    this.enterPhase(this.sim.state.phase)
  }

  private animationFrames(direction: Direction): number[] {
    const base = CHAR_INDEX * 3 * CHAR_COLUMNS + CHAR_DIR_COLUMN[direction]
    return [base, base + CHAR_COLUMNS, base + 2 * CHAR_COLUMNS]
  }

  private createAnimations(): void {
    if (this.anims.exists('walk-down')) return
    for (const direction of ['left', 'right', 'down', 'up'] as Direction[]) {
      const [stand, stepA, stepB] = this.animationFrames(direction)
      this.anims.create({
        key: `walk-${direction}`,
        frames: [stand, stepA, stand, stepB].map((frame) => ({ key: 'chars', frame })),
        frameRate: 8,
        repeat: -1,
      })
      this.anims.create({
        key: `idle-${direction}`,
        frames: [{ key: 'chars', frame: stand }],
        frameRate: 1,
        repeat: -1,
      })
    }
    const [stand, stepA] = this.animationFrames('down')
    this.anims.create({
      key: 'type',
      frames: [
        { key: 'chars', frame: stand },
        { key: 'chars', frame: stepA },
      ],
      frameRate: 3,
      repeat: -1,
    })
  }

  private drawRoom(): void {
    const width = ROOM.cols * TILE
    const g = this.add.graphics().setDepth(0)

    g.fillStyle(0x8f5f2e, 1)
    g.fillRect(ROOM.x, FLOOR_TOP, width, FLOOR_BOTTOM - FLOOR_TOP)
    g.fillStyle(0x875928, 1)
    for (let col = 0; col < ROOM.cols; col += 4) {
      g.fillRect(ROOM.x + col * TILE, FLOOR_TOP, TILE * 2, FLOOR_BOTTOM - FLOOR_TOP)
    }
    g.fillStyle(0x6e4620, 1)
    for (let col = 0; col <= ROOM.cols; col++) {
      g.fillRect(ROOM.x + col * TILE - 1, FLOOR_TOP, 2, FLOOR_BOTTOM - FLOOR_TOP)
    }
    for (let row = WALL_ROWS; row < ROOM.rows; row += 2) {
      g.fillRect(ROOM.x, ROOM.y + row * TILE - 1, width, 2)
    }

    for (let col = 0; col < ROOM.cols; col++) {
      for (let row = 0; row < WALL_ROWS; row++) {
        const isWindow = col >= 4 && col <= 6 && row === 0
        const tile = isWindow ? WALL_TILES.window : WALL_TILES.wall
        this.add
          .image(ROOM.x + col * TILE + TILE / 2, ROOM.y + row * TILE + TILE / 2, tile.sheet, tile.frame)
          .setScale(SPRITE_SCALE)
          .setDepth(1)
      }
    }

    for (const col of [10, 13, 17]) {
      this.add
        .image(
          ROOM.x + col * TILE + TILE / 2,
          ROOM.y + TILE + TILE / 2,
          WALL_TILES.painting.sheet,
          WALL_TILES.painting.frame,
        )
        .setScale(SPRITE_SCALE)
        .setDepth(2)
    }
  }

  private placeFurniture(): void {
    for (const placement of FURNITURE_PLACEMENTS) {
      const y = ROOM.y + placement.row * TILE + TILE
      this.add
        .image(ROOM.x + placement.col * TILE + TILE / 2, y, placement.sheet, placement.frame)
        .setScale(SPRITE_SCALE)
        .setOrigin(0.5, 1)
        .setDepth(y)
    }

    this.add
      .image(DESK_X + TILE / 2, DESK_Y + 10, FURNITURE.monitor.sheet, FURNITURE.monitor.frame)
      .setScale(SPRITE_SCALE)
      .setOrigin(0.5, 1)
      .setDepth(DESK_Y + 1)

    this.add
      .image(DESK_SPOT.x, DESK_SPOT.y - 12, FURNITURE.stool.sheet, FURNITURE.stool.frame)
      .setScale(SPRITE_SCALE)
      .setOrigin(0.5, 1)
      .setDepth(DESK_SPOT.y - 20)
  }

  private createDev(): void {
    this.dev = this.add
      .sprite(DESK_SPOT.x, DESK_SPOT.y, 'chars', this.animationFrames('down')[0])
      .setScale(SPRITE_SCALE)
      .setOrigin(0.5, 1)
      .setDepth(DESK_SPOT.y)
    this.dev.play('idle-down')
  }

  private createProgress(): void {
    this.progressBar = new ProgressBar(this, { x: DESK_X + TILE / 2, y: DESK_Y - 82, width: 240, height: 16 })
    this.progressBar.setDepth(400)
    this.progressLabel = this.add.text(0, 0, '', textStyle(FONT_SIZE.sm, COLOR.textDim)).setDepth(400)
    this.progressBar.setVisible(false)
    this.progressLabel.setVisible(false)
  }

  private createHud(): void {
    const hud = this.add.graphics().setDepth(500)
    hud.fillStyle(COLOR.panel, 1)
    hud.fillRect(0, 0, GAME_WIDTH, 64)
    hud.lineStyle(2, COLOR.border, 1)
    hud.strokeRect(0, 0, GAME_WIDTH, 64)

    this.add.text(24, 22, 'GARAGE STUDIO', textStyle(FONT_SIZE.sm, COLOR.accentCss, true)).setDepth(501)
    this.moneyText = this.add.text(300, 22, '', textStyle(FONT_SIZE.sm, COLOR.moneyCss)).setDepth(501)
    this.dateText = this.add.text(520, 22, '', textStyle(FONT_SIZE.sm, COLOR.text)).setDepth(501)
    this.fansText = this.add.text(700, 22, '', textStyle(FONT_SIZE.sm, COLOR.text)).setDepth(501)
    this.phaseText = this.add.text(790, 22, '', textStyle(FONT_SIZE.sm, COLOR.textDim)).setDepth(501)

    this.actionButton = new Button(this, {
      x: 1050,
      y: 32,
      width: 190,
      height: 40,
      label: 'NEW PROJECT',
      style: 'primary',
      onClick: () => this.action(),
    })
    this.actionButton.setDepth(501)

    new Button(this, {
      x: 1190,
      y: 32,
      width: 130,
      height: 40,
      label: 'MENU',
      onClick: () => void this.backToMenu(),
    }).setDepth(501)
  }

  private clock(): void {
    const phase = this.sim.state.phase
    if (phase !== 'dev' && phase !== 'sales') return

    const events = tick(this.sim)
    this.refresh()

    const salesWeek = events.find((event) => event.type === 'sales-week')
    const salesEnd = events.find((event) => event.type === 'sales-end')

    if (salesWeek && salesWeek.type === 'sales-week' && salesWeek.revenue > 0) this.floatMoney(salesWeek.revenue)
    if (events.some((event) => event.type === 'dev-complete')) this.onDevComplete()
    if (salesEnd && salesEnd.type === 'sales-end') {
      this.toast(`${salesEnd.game.unitsSold.toLocaleString('en-US')} UNITS  $${salesEnd.game.revenue.toLocaleString('en-US')}`)
    }
    if (this.sim.state.phase === 'over') this.onGameOver()
  }

  private enterPhase(phase: string): void {
    if (phase === this.lastPhase) return
    this.lastPhase = phase

    if (phase === 'dev') {
      this.wanderTimer?.remove()
      this.wanderTimer = null
      this.moveTo(DESK_SPOT.x, DESK_SPOT.y, () => this.dev.play('type', true))
      return
    }
    if (phase === 'idle' || phase === 'sales') this.scheduleWander()
  }

  private scheduleWander(): void {
    this.wanderTimer?.remove()
    const phase = this.sim.state.phase
    if (phase !== 'idle' && phase !== 'sales') return
    this.wanderTimer = this.time.delayedCall(Phaser.Math.Between(600, 1600), () => {
      const target = Phaser.Utils.Array.GetRandom(WAYPOINTS)
      this.moveTo(target.x, target.y, () => {
        this.dev.play(`idle-${this.facing}`)
        this.scheduleWander()
      })
    })
  }

  private moveTo(x: number, y: number, onArrive: () => void): void {
    const dx = x - this.dev.x
    const dy = y - this.dev.y
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
    this.dev.play(`walk-${this.facing}`, true)

    this.moveTween?.stop()
    const distance = Phaser.Math.Distance.Between(this.dev.x, this.dev.y, x, y)
    this.moveTween = this.tweens.add({
      targets: this.dev,
      x,
      y,
      duration: Math.max(220, (distance / WALK_SPEED) * 1000),
      onUpdate: () => this.dev.setDepth(this.dev.y),
      onComplete: () => {
        this.dev.setDepth(this.dev.y)
        onArrive()
      },
    })
  }

  private refresh(): void {
    const state = this.sim.state
    const date = dateOf(this.sim)
    const pad = (value: number) => String(value).padStart(2, '0')

    this.moneyText.setText(`$${Math.round(state.cash).toLocaleString('en-US')}`)
    this.dateText.setText(`${date.year} M${pad(date.month)} W${pad(date.week)}`)
    this.fansText.setText(`FANS ${state.fans.toLocaleString('en-US')}`)
    this.phaseText.setText(state.outcome ? state.outcome.toUpperCase() : PHASE_LABELS[state.phase]!)

    const project = state.project
    const showProgress = Boolean(project) && (state.phase === 'dev' || state.phase === 'release')
    this.progressBar.setVisible(showProgress)
    this.progressLabel.setVisible(showProgress)
    if (project) {
      this.progressBar.setValue(projectProgress(project))
      this.progressLabel.setText(`${project.stage.toUpperCase()} ${project.spent[project.stage]}/${project.stagePoints[project.stage]}`)
      centerText(this.progressLabel, DESK_X + TILE / 2, DESK_Y - 106)
    }

    this.actionButton.setLabel(ACTION_LABELS[state.phase] ?? 'NEW PROJECT')
    this.actionButton.setEnabled(state.phase !== 'dev' && state.phase !== 'sales')
  }

  private action(): void {
    const state = this.sim.state
    if (state.phase === 'idle') {
      this.startDefaultProject()
      return
    }
    if (state.phase === 'release') {
      releaseGame(this.sim)
      this.dev.play('idle-down', true)
      this.cameras.main.flash(180, 255, 255, 255)
      this.refresh()
      return
    }
    if (state.phase === 'over') {
      startNewSession('office')
      this.scene.restart()
    }
  }

  private startDefaultProject(): void {
    const content = this.sim.content
    const balance = content.balance
    const genre = content.genres.find((entry) => entry.id === 'rpg') ?? content.genres[0]!
    const topic = content.topics.find((entry) => entry.id === 'fantasy') ?? content.topics[0]!
    const platforms = availablePlatforms(this.sim)
    const platform = platforms[platforms.length - 1]

    if (!platform) {
      this.toast('NO PLATFORM AVAILABLE')
      return
    }

    try {
      startProject(this.sim, {
        topicId: topic.id,
        genreId: genre.id,
        platformId: platform.id,
        sliders: allocateSliders(content, genre.id, balance.sliderBudget),
      })
      this.toast(`${topic.name.toUpperCase()} ${genre.name.toUpperCase()} ON ${platform.name.toUpperCase()}`)
    } catch (error) {
      this.toast((error as Error).message.toUpperCase())
    }

    this.refresh()
    this.enterPhase(this.sim.state.phase)
  }

  private onDevComplete(): void {
    const review = this.sim.state.currentReview
    const project = this.sim.state.project
    if (!review || !project) return
    this.enterPhase('release')

    const summary = Object.entries(review.categories)
      .map(([category, score]) => `${category.toUpperCase()} ${score.toFixed(1)}`)
      .join('\n')

    const buttons = project.bugs > 0
      ? [
          { label: `FIX BUGS (${project.bugs})`, value: 'fix' },
          { label: 'SHIP IT', value: 'ship', style: 'primary' as const },
        ]
      : [{ label: 'SHIP IT', value: 'ship', style: 'primary' as const }]

    void openModal(this, {
      title: `REVIEW ${review.overall.toFixed(1)} / 10`,
      message: summary,
      buttons,
    }).then((value) => {
      if (value === 'fix') {
        try {
          fixBug(this.sim)
        } catch {
          this.refresh()
        }
        this.refresh()
        if (this.sim.state.phase === 'release') this.onDevComplete()
        return
      }
      this.action()
    })
  }

  private onGameOver(): void {
    const won = this.sim.state.outcome === 'win'
    void openModal(this, {
      title: won ? 'YOU WIN' : 'BANKRUPT',
      message: won
        ? 'Your studio value reached the goal. Keep going for a bigger score.'
        : 'The studio ran out of cash. Start over with what you learned.',
      buttons: [{ label: 'NEW GAME', value: 'new', style: 'primary' }],
    }).then(() => {
      startNewSession('office')
      this.scene.restart()
    })
  }

  private backToMenu(): Promise<void> {
    return openModal(this, {
      title: 'BACK TO MENU',
      message: 'Your studio stays in memory until the page is reloaded.',
      buttons: [
        { label: 'CANCEL', value: 'cancel' },
        { label: 'MENU', value: 'menu', style: 'primary' },
      ],
    }).then((value) => {
      if (value === 'menu') this.scene.start('MainMenu')
    })
  }

  private toast(text: string): void {
    const label = this.add.text(0, 0, text, textStyle(FONT_SIZE.md, COLOR.accentCss, true)).setDepth(600)
    centerText(label, GAME_WIDTH / 2, 140)
    this.tweens.add({ targets: label, y: label.y - 48, alpha: 0, duration: 1800, onComplete: () => label.destroy() })
  }

  private floatMoney(amount: number): void {
    const label = this.add.text(0, 0, `+$${amount.toLocaleString('en-US')}`, textStyle(FONT_SIZE.sm, COLOR.goodCss)).setDepth(600)
    label.setPosition(340, 68)
    this.tweens.add({ targets: label, y: label.y + 26, alpha: 0, duration: 1200, onComplete: () => label.destroy() })
  }
}
