import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import type { Sim } from '../engine/sim'
import {
  availablePlatforms,
  dateOf,
  emptySliders,
  findGenre,
  findPlatform,
  findTopic,
  projectCost,
  lockedPlatformCount,
  projectWeeks,
  selectableGenres,
  selectableTopics,
  startProject,
  totalUnits,
} from '../engine/sim'
import { platformFitFor, topicFitFor } from '../engine/score'
import { STAGE_IDS } from '../engine/types'
import type { Genre, Platform, Sliders, StageId, Topic } from '../engine/types'
import { allocateSliders } from '../game/allocate'
import { playSfx } from '../game/audio'
import { getSession, startNewSession } from '../game/session'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { ScrollList } from '../ui/ScrollList'
import { Slider } from '../ui/Slider'
import { COLOR, FONT_SIZE, addOverlayHeader, centerText, textStyle } from '../ui/theme'

const STAGE_LABELS: Record<StageId, string> = {
  engine: 'ENGINE',
  gameplay: 'GAMEPLAY',
  story: 'STORY',
  graphics: 'GRAPHICS',
  sound: 'SOUND',
}

function fitStars(value: number): string {
  if (value >= 0.75) return '***'
  if (value >= 0.5) return '**'
  if (value >= 0.25) return '*'
  return '-'
}

export class ProjectSetupScene extends Phaser.Scene {
  private sim!: Sim
  private page: 'pick' | 'allocate' = 'pick'
  private topicId = ''
  private genreId = ''
  private platformId = ''
  private sliders: Sliders = emptySliders()
  private pageRoot: Phaser.GameObjects.Container | null = null
  private summaryLines: Phaser.GameObjects.Text[] = []
  private allocatedText!: Phaser.GameObjects.Text
  private costText!: Phaser.GameObjects.Text
  private warningText!: Phaser.GameObjects.Text
  private sliderWidgets: Slider[] = []
  private startButton: Button | null = null

  constructor() {
    super('ProjectSetup')
  }

  create(): void {
    this.sim = getSession() ?? startNewSession('setup')
    this.page = 'pick'
    this.sliders = emptySliders()
    this.topicId = selectableTopics(this.sim)[0]?.id ?? ''
    this.genreId = selectableGenres(this.sim)[0]?.id ?? ''
    const platforms = availablePlatforms(this.sim)
    this.platformId = platforms[platforms.length - 1]?.id ?? ''

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR.overlay, 0.75).setOrigin(0, 0)
    dim.setInteractive()

    this.buildPage()
  }

  private close(): void {
    this.scene.stop()
    this.scene.resume('Office')
  }

  private buildPage(): void {
    this.pageRoot?.destroy(true)
    this.summaryLines = []
    this.sliderWidgets = []
    this.startButton = null
    this.pageRoot = this.add.container(0, 0)
    if (this.page === 'pick') this.buildPickPage()
    else this.buildAllocatePage()
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.pageRoot!.add(object)
    return object
  }

  private sectionLabel(x: number, y: number, text: string): void {
    const label = this.add.text(Math.round(x), Math.round(y), text, textStyle(FONT_SIZE.sm, COLOR.textDim))
    this.track(label)
  }

  private buildPickPage(): void {
    addOverlayHeader(this, 'NEW PROJECT — STEP 1 OF 2')

    const topics = selectableTopics(this.sim)
    const genres = selectableGenres(this.sim)
    const platforms = availablePlatforms(this.sim)
    const lockedTopics = this.sim.content.topics.length - topics.length
    const lockedGenres = this.sim.content.genres.length - genres.length
    const lockedPlatforms = lockedPlatformCount(this.sim)

    this.sectionLabel(70, 132, lockedTopics > 0 ? `TOPIC · ${lockedTopics} LOCKED` : 'TOPIC')
    const topicList = new ScrollList<Topic>(this, {
      x: 240,
      y: 430,
      width: 360,
      height: 540,
      items: topics,
      itemHeight: 36,
      render: (topic) => topic.name.toUpperCase(),
      onSelect: (topic) => {
        this.topicId = topic.id
        this.refreshSummary()
      },
    })
    this.track(topicList)

    this.sectionLabel(450, 132, lockedGenres > 0 ? `GENRE · ${lockedGenres} LOCKED` : 'GENRE')
    const genreList = new ScrollList<Genre>(this, {
      x: 540,
      y: 350,
      width: 200,
      height: 340,
      items: genres,
      itemHeight: 36,
      render: (genre) => genre.name.toUpperCase(),
      onSelect: (genre) => {
        this.genreId = genre.id
        this.refreshSummary()
      },
    })
    this.track(genreList)

    this.sectionLabel(690, 132, `PLATFORM — ${dateOf(this.sim).year}${lockedPlatforms > 0 ? ` · ${lockedPlatforms} NEED TECH` : ''}`)
    const platformList = new ScrollList<Platform>(this, {
      x: 820,
      y: 430,
      width: 280,
      height: 540,
      items: platforms,
      itemHeight: 36,
      render: (platform) => platform.name.toUpperCase(),
      onSelect: (platform) => {
        this.platformId = platform.id
        this.refreshSummary()
      },
    })
    this.track(platformList)

    const summary = new Panel(this, { x: 1115, y: 430, width: 290, height: 540, title: 'PROJECT' })
    this.track(summary)

    const contentX = Math.round(summary.left + 22)
    for (let index = 0; index < 8; index++) {
      const line = this.add.text(contentX, Math.round(summary.top + 64 + index * 30), '', textStyle(FONT_SIZE.sm, COLOR.text))
      summary.add(line)
      this.summaryLines.push(line)
    }

    const lockedHint = this.add.text(
      contentX,
      Math.round(summary.top + 300),
      `LOCKED: ${lockedTopics} TOPICS · ${lockedGenres} GENRES · ${lockedPlatforms} PLATFORMS\nOPEN RESEARCH IN THE STUDIO TO UNLOCK`,
      { ...textStyle(10, COLOR.textDim), lineSpacing: 6 },
    )
    summary.add(lockedHint)

    const hint = this.add.text(contentX, Math.round(summary.top + 360), 'FIT: *** GREAT\n     **  GOOD\n     *   WEAK\n     -   BAD', {
      ...textStyle(10, COLOR.textDim),
      lineSpacing: 6,
    })
    summary.add(hint)

    const cancel = new Button(this, {
      x: summary.x,
      y: 620,
      width: 220,
      height: 44,
      label: 'CANCEL',
      onClick: () => this.close(),
    })
    this.track(cancel)

    const next = new Button(this, {
      x: summary.x,
      y: 676,
      width: 220,
      height: 48,
      label: 'NEXT: ALLOCATE',
      style: 'primary',
      onClick: () => {
        this.page = 'allocate'
        this.buildPage()
      },
    })
    this.track(next)

    topicList.setSelectedIndex(Math.max(0, topics.findIndex((topic) => topic.id === this.topicId)), false)
    genreList.setSelectedIndex(Math.max(0, genres.findIndex((genre) => genre.id === this.genreId)), false)
    platformList.setSelectedIndex(Math.max(0, platforms.findIndex((platform) => platform.id === this.platformId)), false)
    this.refreshSummary()
  }

  private refreshSummary(): void {
    if (this.summaryLines.length === 0) return
    const content = this.sim.content
    const balance = content.balance

    const topic = this.topicId ? findTopic(content, this.topicId) : null
    const genre = this.genreId ? findGenre(content, this.genreId) : null
    const platform = this.platformId ? findPlatform(content, this.platformId) : null

    const topicFit = topic && genre ? topicFitFor(topic, genre.id, balance) : 0
    const platformFit = platform && genre ? platformFitFor(platform, genre.id, balance) : 0
    const suggested = genre ? allocateSliders(content, genre.id, balance.sliderBudget) : emptySliders()
    const cost = platform ? projectCost(content, platform, suggested) : 0

    const lines = [
      `TOPIC   ${topic ? topic.name.toUpperCase() : '-'}`,
      `GENRE   ${genre ? genre.name.toUpperCase() : '-'}`,
      `PLATFORM ${platform ? platform.name.toUpperCase() : '-'}`,
      '',
      `TOPIC FIT    ${fitStars(topicFit)}`,
      `PLATFORM FIT ${fitStars(platformFit)}`,
      '',
      `FULL PLAN $${cost.toLocaleString('en-US')} / ${projectWeeks(content, suggested)}W`,
    ]
    lines.forEach((line, index) => this.summaryLines[index]!.setText(line))
  }

  private buildAllocatePage(): void {
    const content = this.sim.content
    const balance = content.balance
    const genre = this.genreId ? findGenre(content, this.genreId) : null

    addOverlayHeader(this, `ALLOCATE TIME — ${genre ? genre.name.toUpperCase() : ''}`)

    const panel = new Panel(this, { x: GAME_WIDTH / 2, y: 380, width: 840, height: 560, title: `BUDGET ${balance.sliderBudget} UNITS` })
    this.track(panel)

    STAGE_IDS.forEach((stage, index) => {
      const slider = new Slider(this, {
        x: GAME_WIDTH / 2,
        y: 180 + index * 84,
        width: 620,
        min: 0,
        max: balance.sliderBudget,
        step: 1,
        value: this.sliders[stage],
        label: STAGE_LABELS[stage],
        format: (value) => `${value}u`,
        onChange: (value) => {
          this.sliders[stage] = value
          this.refreshAllocate()
        },
      })
      this.track(slider)
      this.sliderWidgets.push(slider)
    })

    this.allocatedText = this.add.text(0, 0, '', textStyle(FONT_SIZE.sm, COLOR.text))
    centerText(this.allocatedText, GAME_WIDTH / 2, 548)
    this.track(this.allocatedText)

    this.costText = this.add.text(0, 0, '', textStyle(FONT_SIZE.sm, COLOR.text))
    centerText(this.costText, GAME_WIDTH / 2, 574)
    this.track(this.costText)

    this.warningText = this.add.text(0, 0, '', textStyle(FONT_SIZE.sm, COLOR.dangerCss))
    centerText(this.warningText, GAME_WIDTH / 2, 600)
    this.track(this.warningText)

    const back = new Button(this, {
      x: 380,
      y: 634,
      width: 200,
      height: 48,
      label: 'BACK',
      onClick: () => {
        this.page = 'pick'
        this.buildPage()
      },
    })
    this.track(back)

    const suggest = new Button(this, {
      x: 620,
      y: 634,
      width: 240,
      height: 48,
      label: 'SUGGEST PLAN',
      onClick: () => {
        if (!genre) return
        this.sliders = allocateSliders(content, genre.id, balance.sliderBudget)
        this.sliderWidgets.forEach((slider, index) => slider.setValue(this.sliders[STAGE_IDS[index]!]!))
        this.refreshAllocate()
      },
    })
    this.track(suggest)

    this.startButton = new Button(this, {
      x: 900,
      y: 634,
      width: 240,
      height: 48,
      label: 'START PROJECT',
      style: 'primary',
      onClick: () => this.start(),
    })
    this.track(this.startButton)

    this.refreshAllocate()
  }

  private refreshAllocate(): void {
    const content = this.sim.content
    const platform = this.platformId ? findPlatform(content, this.platformId) : null
    const units = totalUnits(this.sliders)
    const cost = platform ? projectCost(content, platform, this.sliders) : 0
    const cash = this.sim.state.cash

    const weeks = projectWeeks(content, this.sliders)
    this.allocatedText.setText(`ALLOCATED ${units} / ${content.balance.sliderBudget} UNITS · ${weeks} ${weeks === 1 ? 'WEEK' : 'WEEKS'}`)
    this.costText.setText(`COST $${cost.toLocaleString('en-US')} · CASH $${Math.round(cash).toLocaleString('en-US')}`)

    const problems: string[] = []
    if (units === 0) problems.push('ALLOCATE AT LEAST 1 UNIT')
    if (units > content.balance.sliderBudget) problems.push('OVER BUDGET')
    if (cost > cash) problems.push('NOT ENOUGH CASH')
    this.warningText.setText(problems.join(' · '))
    this.startButton?.setEnabled(problems.length === 0)
  }

  private start(): void {
    try {
      startProject(this.sim, {
        topicId: this.topicId,
        genreId: this.genreId,
        platformId: this.platformId,
        sliders: this.sliders,
      })
      playSfx(this, 'select')
      this.close()
    } catch (error) {
      playSfx(this, 'error')
      this.warningText.setText((error as Error).message.toUpperCase())
    }
  }
}
