import Phaser from 'phaser'
import type { ResearchOption } from '../engine/research'
import { researchOptions, startResearch } from '../engine/research'
import type { Sim } from '../engine/sim'
import { availablePlatforms, dateOf } from '../engine/sim'
import { playSfx } from '../game/audio'
import { getSession, startNewSession } from '../game/session'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { ProgressBar } from '../ui/ProgressBar'
import { ScrollList } from '../ui/ScrollList'
import { addOverlayHeader, COLOR, FONT_SIZE, centerText, textStyle } from '../ui/theme'

const DETAIL_LINES = 7

export class ResearchScene extends Phaser.Scene {
  private sim!: Sim
  private options: ResearchOption[] = []
  private selectedIndex = 0
  private list!: ScrollList<ResearchOption>
  private infoText!: Phaser.GameObjects.Text
  private detailLines: Phaser.GameObjects.Text[] = []
  private progressText!: Phaser.GameObjects.Text
  private progressBar!: ProgressBar
  private startButton!: Button

  constructor() {
    super('Research')
  }

  create(): void {
    this.sim = getSession() ?? startNewSession('research')
    this.selectedIndex = 0
    this.detailLines = []
    this.cameras.main.setBackgroundColor(COLOR.bg)

    addOverlayHeader(this, 'RESEARCH')

    this.infoText = this.add.text(40, 116, '', textStyle(FONT_SIZE.sm, COLOR.text))

    this.list = new ScrollList<ResearchOption>(this, {
      x: 260,
      y: 420,
      width: 420,
      height: 520,
      items: [],
      itemHeight: 32,
      render: (option) => this.renderOption(option),
      onSelect: (option) => {
        this.selectedIndex = this.options.indexOf(option)
        this.refresh()
      },
    })

    const panel = new Panel(this, { x: 890, y: 420, width: 580, height: 520, title: 'DETAILS' })
    const contentX = Math.round(panel.left + 30)
    for (let index = 0; index < DETAIL_LINES; index++) {
      const line = this.add.text(contentX, Math.round(panel.top + 70 + index * 34), '', textStyle(FONT_SIZE.sm, COLOR.text))
      panel.add(line)
      this.detailLines.push(line)
    }

    this.progressText = this.add.text(0, 0, '', textStyle(FONT_SIZE.sm, COLOR.accentCss))
    centerText(this.progressText, 890, 646)

    this.progressBar = new ProgressBar(this, { x: 890, y: 668, width: 420, height: 16, showPercent: false })

    this.startButton = new Button(this, {
      x: 850,
      y: 600,
      width: 280,
      height: 48,
      label: 'START RESEARCH',
      style: 'primary',
      onClick: () => this.begin(),
    })

    new Button(this, {
      x: 1105,
      y: 600,
      width: 140,
      height: 48,
      label: 'CLOSE',
      onClick: () => this.close(),
    })

    this.input.keyboard?.on('keydown-ESC', () => this.close())
    this.input.keyboard?.on('keydown-UP', () => this.move(-1))
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1))
    this.input.keyboard?.on('keydown-ENTER', () => this.begin())

    this.refreshList()
  }

  private renderOption(option: ResearchOption): string {
    const marker = option.status === 'owned' ? '[X]' : option.status === 'available' ? '[ ]' : '[-]'
    return `${marker} ${option.node.name}`
  }

  private move(direction: number): void {
    this.selectedIndex = Phaser.Math.Clamp(this.selectedIndex + direction, 0, Math.max(0, this.options.length - 1))
    this.list.setSelectedIndex(this.selectedIndex, false)
    this.refresh()
  }

  private refreshList(): void {
    this.options = researchOptions(this.sim.content, this.sim.state)
    this.list.setItems(this.options)
    this.list.setSelectedIndex(Phaser.Math.Clamp(this.selectedIndex, 0, Math.max(0, this.options.length - 1)), false)
    this.refresh()
  }

  private selected(): ResearchOption | null {
    return this.options[this.selectedIndex] ?? null
  }

  private begin(): void {
    const option = this.selected()
    if (!option) return
    try {
      startResearch(this.sim, option.node.id)
      playSfx(this, 'select')
      this.refreshList()
    } catch (error) {
      playSfx(this, 'error')
      this.detailLines[DETAIL_LINES - 1]?.setText((error as Error).message.toUpperCase().slice(0, 40))
    }
  }

  private refresh(): void {
    const state = this.sim.state
    const date = dateOf(this.sim)
    const platformCount = availablePlatforms(this.sim).length

    this.infoText.setText(
      `RP ${state.researchPoints} · CASH $${Math.round(state.cash).toLocaleString('en-US')} · ENGINE TECH ${state.techLevel} · PLATFORMS ${platformCount} · ${date.year}`,
    )

    const option = this.selected()
    if (option) {
      const node = option.node
      const effect =
        node.kind === 'topic'
          ? `UNLOCKS THE ${node.target?.toUpperCase()} TOPIC`
          : node.kind === 'genre'
            ? `UNLOCKS THE ${node.target?.toUpperCase()} GENRE`
            : `RAISES ENGINE TECH TO ${node.level}`

      const requires = (node.requires ?? []).map((id) => this.sim.content.research.nodes.find((entry) => entry.id === id)?.name ?? id)
      const status = option.status === 'owned' ? 'RESEARCHED' : option.status === 'available' ? 'AVAILABLE' : 'LOCKED'

      const lines = [
        `NAME     ${node.name}`,
        `EFFECT   ${effect}`,
        `COST     ${node.costRp} RP + $${node.costCash.toLocaleString('en-US')}`,
        `TIME     ${node.weeks} ${node.weeks === 1 ? 'WEEK' : 'WEEKS'}`,
        `STATUS   ${status}`,
        `REQUIRES ${requires.length > 0 ? requires.join(', ') : '-'}`,
        option.missing.length > 0 ? `MISSING  ${option.missing.join(' · ')}` : 'READY TO START',
      ]
      lines.forEach((line, index) => this.detailLines[index]?.setText(line))
    }

    this.startButton.setEnabled(Boolean(option && option.affordable && option.status === 'available'))

    const task = state.research
    if (task) {
      const node = this.sim.content.research.nodes.find((entry) => entry.id === task.nodeId)
      const total = node?.weeks ?? 1
      this.progressText.setText(`IN PROGRESS · ${node?.name ?? task.nodeId} · ${task.weeksLeft}W LEFT`)
      this.progressBar.setValue((total - task.weeksLeft) / total)
      this.progressBar.setVisible(true)
    } else {
      this.progressText.setText('NO ACTIVE RESEARCH PROJECT')
      this.progressBar.setValue(0)
      this.progressBar.setVisible(false)
    }
  }

  private close(): void {
    this.scene.stop()
    this.scene.resume('Office')
  }
}
