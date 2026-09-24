import Phaser from 'phaser'
import { GAME_WIDTH } from '../config'
import type { Sim } from '../engine/sim'
import { dateOf, projectProgress, releaseGame, tick } from '../engine/sim'
import { STAGE_IDS } from '../engine/types'
import {
  CHAR_COLUMNS,
  CHAR_DIR_COLUMN,
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
  deskUnits,
} from '../game/officeLayout'
import type { DeskUnit } from '../game/officeLayout'
import type { Direction } from '../game/officeLayout'
import type { GameProject } from '../engine/types'
import { playSfx } from '../game/audio'
import { getStudioName, submitScore } from '../game/cloud'
import { getSession, resumeSession, saveSession, startNewSession } from '../game/session'
import { Button } from '../ui/Button'
import { openModal } from '../ui/Modal'
import { ProgressBar } from '../ui/ProgressBar'
import { COLOR, FONT_SIZE, centerText, textStyle } from '../ui/theme'

const TICK_MS = 1100
const CHARACTER_COUNT = 6
const FLOOR_BOTTOM = ROOM.y + ROOM.rows * TILE
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

interface Actor {
  sprite: Phaser.GameObjects.Sprite
  charIndex: number
  staffId: string | null
  deskIndex: number
  facing: Direction
  tween: Phaser.Tweens.Tween | null
  wanderTimer: Phaser.Time.TimerEvent | null
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
  private actors: Actor[] = []
  private desks: DeskUnit[] = []
  private rosterSignature = ''
  private deskLayer: Phaser.GameObjects.GameObject[] = []
  private moneyText!: Phaser.GameObjects.Text
  private dateText!: Phaser.GameObjects.Text
  private fansText!: Phaser.GameObjects.Text
  private actionButton!: Button
  private reportButton!: Button
  private researchButton!: Button
  private staffButton!: Button
  private progressBar!: ProgressBar
  private progressLabel!: Phaser.GameObjects.Text
  private stageDots!: Phaser.GameObjects.Graphics
  private lastPhase = ''

  constructor() {
    super('Office')
  }

  create(): void {
    this.sim = getSession() ?? resumeSession() ?? startNewSession('office')
    this.lastPhase = ''
    this.actors = []
    this.deskLayer = []

    this.createAnimations()
    this.drawRoom()
    this.buildDesks()
    this.placeFurniture()
    this.rebuildActors()
    this.createProgress()
    this.createHud()

    this.time.addEvent({ delay: TICK_MS, loop: true, callback: () => this.clock() })

    const onResume = () => {
      this.cameras.main.setVisible(true)
      saveSession()
      this.syncRoster()
      this.refresh()
      this.enterPhase(this.sim.state.phase)
    }
    this.events.on(Phaser.Scenes.Events.RESUME, onResume)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, onResume))

    this.refresh()
    this.enterPhase(this.sim.state.phase)
  }

  private animationFrames(charIndex: number, direction: Direction): number[] {
    const base = charIndex * 3 * CHAR_COLUMNS + CHAR_DIR_COLUMN[direction]
    return [base, base + CHAR_COLUMNS, base + 2 * CHAR_COLUMNS]
  }

  private createAnimations(): void {
    if (this.anims.exists('c0-walk-down')) return
    for (let charIndex = 0; charIndex < CHARACTER_COUNT; charIndex++) {
      for (const direction of ['left', 'right', 'down', 'up'] as Direction[]) {
        const [stand, stepA, stepB] = this.animationFrames(charIndex, direction)
        this.anims.create({
          key: `c${charIndex}-walk-${direction}`,
          frames: [stand, stepA, stand, stepB].map((frame) => ({ key: 'chars', frame })),
          frameRate: 8,
          repeat: -1,
        })
      }
      const [stand, stepA] = this.animationFrames(charIndex, 'down')
      this.anims.create({
        key: `c${charIndex}-type`,
        frames: [
          { key: 'chars', frame: stand },
          { key: 'chars', frame: stepA },
        ],
        frameRate: 3,
        repeat: -1,
      })
    }
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

  private buildDesks(): void {
    this.desks = deskUnits(this.sim.state.officeLevel)
    for (const object of this.deskLayer) object.destroy()
    this.deskLayer = []

    for (const desk of this.desks) {
      for (const col of [desk.leftCol, desk.leftCol + 1]) {
        const y = ROOM.y + 5 * TILE + TILE
        this.deskLayer.push(
          this.add
            .image(ROOM.x + col * TILE + TILE / 2, y, FURNITURE.desk.sheet, FURNITURE.desk.frame)
            .setScale(SPRITE_SCALE)
            .setOrigin(0.5, 1)
            .setDepth(y),
        )
      }
      this.deskLayer.push(
        this.add
          .image(desk.center, DESK_Y + 10, FURNITURE.monitor.sheet, FURNITURE.monitor.frame)
          .setScale(SPRITE_SCALE)
          .setOrigin(0.5, 1)
          .setDepth(DESK_Y + 1),
      )
      this.deskLayer.push(
        this.add
          .image(desk.spot.x, desk.spot.y - 12, FURNITURE.stool.sheet, FURNITURE.stool.frame)
          .setScale(SPRITE_SCALE)
          .setOrigin(0.5, 1)
          .setDepth(desk.spot.y - 20),
      )
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
  }

  private rosterSignatureOf(): string {
    return `${this.sim.state.officeLevel}:${this.sim.state.staff.map((member) => member.id).join(',')}`
  }

  private syncRoster(): void {
    const signature = this.rosterSignatureOf()
    if (signature === this.rosterSignature) return
    this.buildDesks()
    this.rebuildActors()
  }

  private rebuildActors(): void {
    for (const actor of this.actors) {
      actor.tween?.stop()
      actor.wanderTimer?.remove()
      actor.sprite.destroy()
    }
    this.actors = []
    this.rosterSignature = this.rosterSignatureOf()

    const roster: Array<string | null> = [null, ...this.sim.state.staff.map((member) => member.id)]
    roster.forEach((staffId, index) => {
      const desk = this.desks[index] ?? this.desks[this.desks.length - 1]!
      const sprite = this.add
        .sprite(desk.spot.x, desk.spot.y, 'chars', this.animationFrames(index, 'down')[0])
        .setScale(SPRITE_SCALE)
        .setOrigin(0.5, 1)
        .setDepth(desk.spot.y)
      sprite.play(`c${index}-type`)
      this.actors.push({
        sprite,
        charIndex: index,
        staffId,
        deskIndex: index,
        facing: 'down',
        tween: null,
        wanderTimer: null,
      })
    })
  }

  private createProgress(): void {
    this.progressBar = new ProgressBar(this, { x: ROOM.x + (ROOM.cols * TILE) / 2, y: DESK_Y - 82, width: 240, height: 16 })
    this.progressBar.setDepth(400)
    this.progressLabel = this.add.text(0, 0, '', textStyle(FONT_SIZE.sm, COLOR.textDim)).setDepth(400)
    this.stageDots = this.add.graphics().setDepth(400)
    this.progressBar.setVisible(false)
    this.progressLabel.setVisible(false)
    this.stageDots.setVisible(false)
  }

  private drawStageDots(project: GameProject): void {
    const count = STAGE_IDS.length
    const spacing = 22
    const startX = ROOM.x + (ROOM.cols * TILE) / 2 - ((count - 1) * spacing) / 2
    const y = DESK_Y - 104
    this.stageDots.clear()
    STAGE_IDS.forEach((stage, index) => {
      const done = project.spent[stage] >= project.stagePoints[stage]
      const current = project.stage === stage
      this.stageDots.fillStyle(done ? COLOR.good : current ? COLOR.accent : COLOR.border, 1)
      this.stageDots.fillRect(Math.round(startX + index * spacing - 8), y, 16, 8)
    })
  }

  private createHud(): void {
    const hud = this.add.graphics().setDepth(500)
    hud.fillStyle(COLOR.panel, 1)
    hud.fillRect(0, 0, GAME_WIDTH, 64)
    hud.lineStyle(2, COLOR.border, 1)
    hud.strokeRect(0, 0, GAME_WIDTH, 64)

    this.add.text(24, 22, getStudioName(), textStyle(FONT_SIZE.sm, COLOR.accentCss, true)).setDepth(501)
    this.moneyText = this.add.text(210, 22, '', textStyle(FONT_SIZE.sm, COLOR.moneyCss)).setDepth(501)
    this.dateText = this.add.text(400, 22, '', textStyle(FONT_SIZE.sm, COLOR.text)).setDepth(501)
    this.fansText = this.add.text(555, 22, '', textStyle(FONT_SIZE.sm, COLOR.text)).setDepth(501)

    this.researchButton = new Button(this, {
      x: 715,
      y: 32,
      width: 150,
      height: 40,
      label: 'RESEARCH',
      onClick: () => this.openOverlay('Research'),
    })
    this.researchButton.setDepth(501)

    this.staffButton = new Button(this, {
      x: 838,
      y: 32,
      width: 110,
      height: 40,
      label: 'STAFF',
      onClick: () => this.openOverlay('Staff'),
    })
    this.staffButton.setDepth(501)

    this.reportButton = new Button(this, {
      x: 958,
      y: 32,
      width: 110,
      height: 40,
      label: 'REPORT',
      onClick: () => this.openReport(),
    })
    this.reportButton.setDepth(501)

    this.actionButton = new Button(this, {
      x: 1090,
      y: 32,
      width: 160,
      height: 40,
      label: 'NEW PROJECT',
      style: 'primary',
      onClick: () => this.action(),
    })
    this.actionButton.setDepth(501)

    new Button(this, {
      x: 1230,
      y: 32,
      width: 90,
      height: 40,
      label: 'MENU',
      onClick: () => void this.backToMenu(),
    }).setDepth(501)
  }

  private clock(): void {
    const state = this.sim.state
    const researching = state.research !== null
    if (state.phase === 'over') return
    if (state.phase !== 'dev' && state.phase !== 'sales' && !researching) return

    const events = tick(this.sim)
    saveSession()
    this.refresh()

    const salesWeek = events.find((event) => event.type === 'sales-week')
    const salesEnd = events.find((event) => event.type === 'sales-end')
    const researchDone = events.find((event) => event.type === 'research-complete')
    const researchGain = events.find((event) => event.type === 'research-points')

    if (researchGain && researchGain.type === 'research-points') this.toast(`+${researchGain.amount} RP`)
    if (researchDone && researchDone.type === 'research-complete') {
      const node = this.sim.content.research.nodes.find((entry) => entry.id === researchDone.nodeId)
      playSfx(this, 'success')
      this.toast(`${(node?.name ?? researchDone.nodeId).toUpperCase()} RESEARCHED`)
    }
    if (salesWeek && salesWeek.type === 'sales-week' && salesWeek.revenue > 0) this.floatMoney(salesWeek.revenue)
    if (events.some((event) => event.type === 'dev-complete')) this.onDevComplete()
    if (salesEnd && salesEnd.type === 'sales-end') {
      this.toast(`${salesEnd.game.unitsSold.toLocaleString('en-US')} UNITS  $${salesEnd.game.revenue.toLocaleString('en-US')}`)
      playSfx(this, 'money')
      void submitScore(this.sim)
      this.openReport()
    }
    if (this.sim.state.phase === 'over') this.onGameOver()
  }

  private enterPhase(phase: string): void {
    if (phase === this.lastPhase) return
    this.lastPhase = phase

    if (phase === 'dev' || phase === 'release') {
      for (const actor of this.actors) {
        actor.wanderTimer?.remove()
        actor.wanderTimer = null
        const desk = this.desks[actor.deskIndex] ?? this.desks[0]!
        this.moveTo(actor, desk.spot.x, desk.spot.y, () => actor.sprite.play(`c${actor.charIndex}-type`))
      }
      return
    }
    if (phase === 'idle' || phase === 'sales') {
      for (const actor of this.actors) this.scheduleWander(actor)
    }
  }

  private scheduleWander(actor: Actor): void {
    actor.wanderTimer?.remove()
    const phase = this.sim.state.phase
    if (phase !== 'idle' && phase !== 'sales') return
    actor.wanderTimer = this.time.delayedCall(Phaser.Math.Between(600, 2600), () => {
      const target = Phaser.Utils.Array.GetRandom(WAYPOINTS)
      this.moveTo(actor, target.x, target.y, () => {
        actor.sprite.setFrame(this.animationFrames(actor.charIndex, actor.facing)[0]!)
        this.scheduleWander(actor)
      })
    })
  }

  private moveTo(actor: Actor, x: number, y: number, onArrive: () => void): void {
    const dx = x - actor.sprite.x
    const dy = y - actor.sprite.y
    actor.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
    actor.sprite.play(`c${actor.charIndex}-walk-${actor.facing}`, true)

    actor.tween?.stop()
    const distance = Phaser.Math.Distance.Between(actor.sprite.x, actor.sprite.y, x, y)
    actor.tween = this.tweens.add({
      targets: actor.sprite,
      x,
      y,
      duration: Math.max(220, (distance / WALK_SPEED) * 1000),
      onUpdate: () => actor.sprite.setDepth(actor.sprite.y),
      onComplete: () => {
        actor.sprite.setDepth(actor.sprite.y)
        onArrive()
      },
    })
  }

  private refresh(): void {
    const state = this.sim.state
    const date = dateOf(this.sim)
    const pad = (value: number) => String(value).padStart(2, '0')

    this.moneyText.setText(`$${Math.round(state.cash).toLocaleString('en-US')} · RP ${state.researchPoints}`)
    this.dateText.setPosition(Math.round(210 + this.moneyText.width + 20), 22)
    this.dateText.setText(`${date.year} M${pad(date.month)} W${pad(date.week)}`)
    this.fansText.setPosition(Math.round(this.dateText.x + this.dateText.width + 20), 22)
    this.fansText.setText(`F ${state.fans.toLocaleString('en-US')}`)

    const project = state.project
    const showProgress = Boolean(project) && (state.phase === 'dev' || state.phase === 'release')
    this.progressBar.setVisible(showProgress)
    this.progressLabel.setVisible(showProgress)
    this.stageDots.setVisible(showProgress)
    if (project) {
      this.progressBar.setValue(projectProgress(project))
      this.progressLabel.setText(`${project.stage.toUpperCase()} ${project.spent[project.stage]}/${project.stagePoints[project.stage]}`)
      centerText(this.progressLabel, ROOM.x + (ROOM.cols * TILE) / 2, DESK_Y - 130)
      this.drawStageDots(project)
    }

    this.actionButton.setLabel(ACTION_LABELS[state.phase] ?? 'NEW PROJECT')
    this.actionButton.setEnabled(state.phase !== 'dev' && state.phase !== 'sales')
    this.reportButton.setEnabled(state.released.length > 0)
    const task = state.research
    this.researchButton.setLabel(task ? `R&D ${task.weeksLeft}W` : 'RESEARCH')
    this.researchButton.setEnabled(state.phase !== 'over')
    this.staffButton.setLabel(`STAFF ${state.staff.length}`)
    this.staffButton.setEnabled(state.phase !== 'over')
  }

  private action(): void {
    const state = this.sim.state
    if (state.phase === 'idle') {
      this.openSetup()
      return
    }
    if (state.phase === 'release') {
      releaseGame(this.sim)
      for (const actor of this.actors) {
        actor.sprite.setFrame(this.animationFrames(actor.charIndex, 'down')[0]!)
      }
      this.cameras.main.flash(180, 255, 255, 255)
      playSfx(this, 'success')
      this.refresh()
      return
    }
    if (state.phase === 'over') {
      startNewSession('office')
      this.scene.restart()
    }
  }

  private openOverlay(key: string, data?: object): void {
    this.cameras.main.setVisible(false)
    this.scene.launch(key, data)
    this.scene.pause()
  }

  private openSetup(): void {
    this.openOverlay('ProjectSetup')
  }

  private openReport(): void {
    if (this.sim.state.released.length === 0) return
    this.openOverlay('Report', { index: this.sim.state.released.length - 1 })
  }

  private onDevComplete(): void {
    if (!this.sim.state.currentReview) return
    this.enterPhase('release')
    this.toast(`REVIEW ${this.sim.state.currentReview.overall.toFixed(1)} / 10`)
    playSfx(this, 'select')
    this.openOverlay('Review')
  }

  private onGameOver(): void {
    saveSession()
    playSfx(this, this.sim.state.outcome === 'win' ? 'success' : 'error')
    void submitScore(this.sim)
    this.openOverlay('GameOver')
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
    label.setPosition(340, 92)
    this.tweens.add({ targets: label, y: label.y + 26, alpha: 0, duration: 1200, onComplete: () => label.destroy() })
  }
}
