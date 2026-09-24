import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import { allocateSliders } from '../game/allocate'
import { startNewSession } from '../game/session'
import { availablePlatforms, companyValue, dateOf, fixBug, projectProgress, releaseGame, startProject, tick } from '../engine/sim'
import type { Sim } from '../engine/sim'
import type { Topic } from '../engine/types'
import { Button } from '../ui/Button'
import { openModal } from '../ui/Modal'
import { Panel } from '../ui/Panel'
import { ProgressBar } from '../ui/ProgressBar'
import { ScrollList } from '../ui/ScrollList'
import { Slider } from '../ui/Slider'
import { COLOR, FONT_SIZE, centerText, textStyle } from '../ui/theme'

const PHASE_LABELS: Record<string, string> = {
  idle: 'IDLE',
  dev: 'IN DEVELOPMENT',
  release: 'READY TO RELEASE',
  sales: 'ON SALE',
  over: 'FINISHED',
}

export class DevSandboxScene extends Phaser.Scene {
  private sim: Sim | null = null
  private statusText!: Phaser.GameObjects.Text
  private reviewText!: Phaser.GameObjects.Text
  private messageText!: Phaser.GameObjects.Text
  private captionText!: Phaser.GameObjects.Text
  private progressBar!: ProgressBar
  private demoProgressBar!: ProgressBar
  private budgetSlider!: Slider
  private topicList!: ScrollList<Topic>
  private selectedTopicId = 'space'
  private engineButtons: Record<string, Button> = {}

  constructor() {
    super('DevSandbox')
  }

  create(): void {
    this.engineButtons = {}
    this.cameras.main.setBackgroundColor(COLOR.bg)

    const title = this.add.text(0, 0, 'DEV SANDBOX', textStyle(FONT_SIZE.lg, COLOR.accentCss, true))
    title.setPosition(40, 28)

    new Button(this, {
      x: GAME_WIDTH - 130,
      y: 52,
      width: 180,
      height: 44,
      label: 'BACK',
      onClick: () => this.scene.start('MainMenu'),
    })

    this.buildGallery()
    this.buildEnginePanel()

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MainMenu'))
    this.input.keyboard?.on('keydown-T', () => this.advance(1))
    this.input.keyboard?.on('keydown-R', () => this.release())

    this.newGame()
  }

  private buildGallery(): void {
    const panel = new Panel(this, { x: 350, y: 400, width: 620, height: 620, title: 'WIDGET GALLERY' })
    const left = panel.x + panel.left + 40
    const centerX = panel.x

    this.add.text(Math.round(left), 148, 'BUTTONS', textStyle(FONT_SIZE.sm, COLOR.textDim))

    const buttonWidths = 168
    const styles: Array<{ label: string; style: 'default' | 'primary' | 'danger'; offset: number }> = [
      { label: 'DEFAULT', style: 'default', offset: -186 },
      { label: 'PRIMARY', style: 'primary', offset: 0 },
      { label: 'DANGER', style: 'danger', offset: 186 },
    ]
    for (const item of styles) {
      new Button(this, {
        x: centerX + item.offset,
        y: 196,
        width: buttonWidths,
        height: 44,
        label: item.label,
        style: item.style,
        onClick: () => this.captionText.setText(`clicked ${item.label.toLowerCase()}`),
      })
    }

    const disabled = new Button(this, {
      x: centerX - 186,
      y: 256,
      width: buttonWidths,
      height: 44,
      label: 'DISABLED',
      onClick: () => this.captionText.setText('should never fire'),
    })
    disabled.setEnabled(false)

    new Button(this, {
      x: centerX + 0,
      y: 256,
      width: buttonWidths,
      height: 44,
      label: 'MODAL',
      style: 'primary',
      onClick: () => void this.showModal(),
    })

    this.budgetSlider = new Slider(this, {
      x: centerX,
      y: 330,
      width: 520,
      min: 1,
      max: 16,
      step: 1,
      value: 8,
      label: 'GALLERY SLIDER',
      format: (value) => `${value}u`,
      onChange: (value) => this.captionText.setText(`slider = ${value}`),
    })

    this.demoProgressBar = new ProgressBar(this, { x: centerX, y: 386, width: 520, height: 20, value: 0.35, showPercent: true })
    new Button(this, {
      x: centerX + 0,
      y: 434,
      width: 200,
      height: 40,
      label: 'PROGRESS +10%',
      onClick: () => this.demoProgressBar.setValue((this.demoProgressBar.getValue() + 0.1) % 1.1),
    })

    this.add.text(Math.round(left), 470, 'SCROLL LIST (WHEEL / CLICK)', textStyle(FONT_SIZE.sm, COLOR.textDim))

    this.topicList = new ScrollList<Topic>(this, {
      x: centerX,
      y: 588,
      width: 540,
      height: 200,
      items: [],
      render: (topic) => topic.name.toUpperCase(),
      onSelect: (topic) => {
        this.selectedTopicId = topic.id
        this.captionText.setText(`topic = ${topic.name.toLowerCase()}`)
      },
    })

    this.captionText = this.add.text(Math.round(left), 700, 'ready', textStyle(FONT_SIZE.sm, COLOR.accentCss))
    this.captionText.setOrigin(0, 0.5)
  }

  private buildEnginePanel(): void {
    const panel = new Panel(this, { x: 940, y: 400, width: 620, height: 620, title: 'ENGINE DEMO' })
    const left = panel.x + panel.left + 40

    this.statusText = this.add.text(Math.round(left), 170, '', {
      ...textStyle(FONT_SIZE.sm, COLOR.text),
      lineSpacing: 10,
    })

    this.reviewText = this.add.text(Math.round(left), 388, '', textStyle(FONT_SIZE.sm, COLOR.accentCss))

    this.progressBar = new ProgressBar(this, { x: panel.x, y: 434, width: 520, height: 20, showPercent: true })

    this.messageText = this.add.text(Math.round(left), 466, '', textStyle(FONT_SIZE.sm, COLOR.dangerCss))

    const centerX = panel.x
    const definitions: Array<{ key: string; label: string; x: number; y: number; style?: 'default' | 'primary'; onClick: () => void }> = [
      { key: 'new', label: 'NEW GAME', x: -186, y: 520, style: 'default', onClick: () => this.newGame() },
      { key: 'start', label: 'START PROJECT', x: 0, y: 520, style: 'primary', onClick: () => this.beginProject() },
      { key: 'tick', label: 'TICK', x: 186, y: 520, onClick: () => this.advance(1) },
      { key: 'fix', label: 'FIX BUG', x: -186, y: 590, onClick: () => this.repairBug() },
      { key: 'release', label: 'RELEASE', x: 0, y: 590, style: 'primary', onClick: () => this.release() },
      { key: 'tick4', label: 'TICK x4', x: 186, y: 590, onClick: () => this.advance(4) },
    ]
    for (const definition of definitions) {
      this.engineButtons[definition.key] = new Button(this, {
        x: centerX + definition.x,
        y: definition.y,
        width: 172,
        height: 48,
        label: definition.label,
        style: definition.style ?? 'default',
        onClick: definition.onClick,
      })
    }

    const hint = this.add.text(0, 0, 'T = TICK   R = RELEASE   ESC = MENU', textStyle(FONT_SIZE.sm, COLOR.textDim))
    centerText(hint, GAME_WIDTH / 2, GAME_HEIGHT - 20)
  }

  private newGame(): void {
    this.sim = startNewSession('sandbox-seed')
    this.selectedTopicId = 'space'
    this.topicList.setItems(this.sim.content.topics)
    this.topicList.setSelectedIndex(0)
    this.messageText.setText('')
    this.captionText.setText('new session')
    this.refresh()
  }

  private beginProject(): void {
    if (!this.sim) return
    const sim = this.sim
    if (sim.state.phase !== 'idle') {
      this.messageText.setText('project already in progress')
      return
    }
    const budget = Math.round(this.budgetSlider.getValue())
    const platforms = availablePlatforms(sim)
    const platform = platforms[platforms.length - 1]
    if (!platform) {
      this.messageText.setText('no platform available')
      return
    }
    try {
      startProject(sim, {
        topicId: this.selectedTopicId,
        genreId: 'rpg',
        platformId: platform.id,
        sliders: allocateSliders(sim.content, 'rpg', budget),
      })
      this.messageText.setText('')
    } catch (error) {
      this.messageText.setText((error as Error).message)
    }
    this.refresh()
  }

  private advance(times: number): void {
    if (!this.sim) return
    for (let i = 0; i < times; i++) {
      if (this.sim.state.phase === 'over') break
      tick(this.sim)
    }
    this.refresh()
  }

  private repairBug(): void {
    if (!this.sim) return
    try {
      fixBug(this.sim)
      this.messageText.setText('')
    } catch (error) {
      this.messageText.setText((error as Error).message)
    }
    this.refresh()
  }

  private release(): void {
    if (!this.sim) return
    try {
      releaseGame(this.sim)
      this.messageText.setText('')
    } catch (error) {
      this.messageText.setText((error as Error).message)
    }
    this.refresh()
  }

  private refresh(): void {
    const sim = this.sim
    if (!sim) return
    const { state } = sim
    const date = dateOf(sim)
    const project = state.project
    const pad = (value: string) => value.padEnd(10, ' ')
    const money = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`

    const lines = [
      `${pad('CASH')}${money(state.cash)}`,
      `${pad('VALUATION')}${money(companyValue(sim))}`,
      `${pad('DATE')}${date.year} M${String(date.month).padStart(2, '0')} W${String(date.week).padStart(2, '0')}`,
      `${pad('PHASE')}${state.outcome ? state.outcome.toUpperCase() : PHASE_LABELS[state.phase]}`,
      `${pad('FANS')}${state.fans.toLocaleString('en-US')}`,
      `${pad('RELEASED')}${state.released.length}`,
      `${pad('PROJECT')}${project ? `${project.stage.toUpperCase()} ${project.spent[project.stage]}/${project.stagePoints[project.stage]}` : '-'}`,
      `${pad('BUGS')}${project ? project.bugs : '-'}`,
    ]
    this.statusText.setText(lines.join('\n'))

    const review = state.currentReview
    this.reviewText.setText(review ? `CURRENT REVIEW  ${review.overall.toFixed(1)} / 10` : '')

    const progress = project ? projectProgress(project) : state.phase === 'sales' ? 1 : 0
    this.progressBar.setValue(progress)

    this.engineButtons.new?.setEnabled(true)
    this.engineButtons.start?.setEnabled(state.phase === 'idle')
    this.engineButtons.tick?.setEnabled(state.phase !== 'over')
    this.engineButtons.tick4?.setEnabled(state.phase !== 'over')
    this.engineButtons.fix?.setEnabled(state.phase === 'release' && (project?.bugs ?? 0) > 0)
    this.engineButtons.release?.setEnabled(state.phase === 'release')

    if (state.phase === 'over') {
      const outcome = state.outcome === 'win' ? 'Studio valued above the goal. You win.' : 'Bankrupt.'
      void openModal(this, {
        title: state.outcome === 'win' ? 'VICTORY' : 'GAME OVER',
        message: outcome,
        buttons: [{ label: 'NEW GAME', value: 'new', style: 'primary' }],
      }).then(() => this.newGame())
    }
  }

  private showModal(): Promise<void> {
    return openModal(this, {
      title: 'MODAL WIDGET',
      message: 'Promise-based modal with keyboard-free buttons. Reused for errors, confirms and review popups.',
      buttons: [
        { label: 'CANCEL', value: 'cancel' },
        { label: 'CONFIRM', value: 'confirm', style: 'primary' },
      ],
    }).then((value) => {
      this.captionText.setText(`modal = ${value}`)
    })
  }
}
