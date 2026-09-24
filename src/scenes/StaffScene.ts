import Phaser from 'phaser'
import type { Sim } from '../engine/sim'
import { dateOf } from '../engine/sim'
import type { StaffCandidate } from '../engine/staff'
import {
  findStaffRole,
  fireStaff,
  hireStaff,
  maxOfficeLevel,
  officeTier,
  pointsPerWeekFor,
  staffCandidates,
  staffCapacity,
  upgradeOffice,
  weeklyCostFor,
} from '../engine/staff'
import type { StaffMember } from '../engine/types'
import { playSfx } from '../game/audio'
import { getSession, startNewSession } from '../game/session'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { ScrollList } from '../ui/ScrollList'
import { addOverlayHeader, COLOR, FONT_SIZE, textStyle } from '../ui/theme'

function stars(skill: number): string {
  return '*'.repeat(skill).padEnd(5, '-')
}

export class StaffScene extends Phaser.Scene {
  private sim!: Sim
  private infoText!: Phaser.GameObjects.Text
  private teamDetail!: Phaser.GameObjects.Text
  private candidateDetail!: Phaser.GameObjects.Text
  private teamList!: ScrollList<StaffMember>
  private candidateList!: ScrollList<StaffCandidate>
  private hireButton!: Button
  private fireButton!: Button
  private upgradeButton!: Button
  private selectedStaffId: string | null = null
  private selectedCandidateId: string | null = null

  constructor() {
    super('Staff')
  }

  create(): void {
    this.sim = getSession() ?? startNewSession('staff')
    this.selectedStaffId = this.sim.state.staff[0]?.id ?? null
    this.selectedCandidateId = staffCandidates(this.sim.content, this.sim.state)[0]?.id ?? null
    this.cameras.main.setBackgroundColor(COLOR.bg)

    addOverlayHeader(this, 'STAFF & OFFICES')
    this.infoText = this.add.text(40, 116, '', textStyle(FONT_SIZE.sm, COLOR.text))

    const teamPanel = new Panel(this, { x: 320, y: 390, width: 460, height: 500, title: 'YOUR TEAM' })
    this.teamList = new ScrollList<StaffMember>(this, {
      x: 320,
      y: 350,
      width: 420,
      height: 280,
      items: [],
      itemHeight: 34,
      render: (member) => this.renderMember(member),
      onSelect: (member) => {
        this.selectedStaffId = member.id
        this.refresh()
      },
    })

    this.teamDetail = this.add.text(Math.round(teamPanel.left + 30), Math.round(teamPanel.top + 360), '', {
      ...textStyle(FONT_SIZE.sm, COLOR.textDim),
      lineSpacing: 8,
    })
    teamPanel.add(this.teamDetail)

    const candidatePanel = new Panel(this, { x: 900, y: 390, width: 600, height: 500, title: 'CANDIDATES THIS MONTH' })
    this.candidateList = new ScrollList<StaffCandidate>(this, {
      x: 900,
      y: 350,
      width: 560,
      height: 280,
      items: [],
      itemHeight: 34,
      render: (candidate) => this.renderCandidate(candidate),
      onSelect: (candidate) => {
        this.selectedCandidateId = candidate.id
        this.refresh()
      },
    })

    this.candidateDetail = this.add.text(Math.round(candidatePanel.left + 30), Math.round(candidatePanel.top + 360), '', {
      ...textStyle(FONT_SIZE.sm, COLOR.textDim),
      lineSpacing: 8,
    })
    candidatePanel.add(this.candidateDetail)

    this.fireButton = new Button(this, {
      x: 320,
      y: 666,
      width: 200,
      height: 46,
      label: 'LET GO',
      style: 'danger',
      onClick: () => this.fire(),
    })

    this.hireButton = new Button(this, {
      x: 760,
      y: 666,
      width: 200,
      height: 46,
      label: 'HIRE',
      style: 'primary',
      onClick: () => this.hire(),
    })

    this.upgradeButton = new Button(this, {
      x: 1010,
      y: 666,
      width: 260,
      height: 46,
      label: 'UPGRADE OFFICE',
      onClick: () => this.upgrade(),
    })

    new Button(this, {
      x: 1200,
      y: 116,
      width: 130,
      height: 44,
      label: 'CLOSE',
      onClick: () => this.close(),
    })

    this.input.keyboard?.on('keydown-ESC', () => this.close())
    this.refreshLists()
  }

  private renderMember(member: StaffMember): string {
    const role = findStaffRole(this.sim.content, member.roleId)
    return `${member.name} · ${role.name} ${stars(member.skill)}`
  }

  private renderCandidate(candidate: StaffCandidate): string {
    const role = findStaffRole(this.sim.content, candidate.roleId)
    return `${candidate.name} · ${role.name} ${stars(candidate.skill)} · $${candidate.salary}/W`
  }

  private refreshLists(): void {
    const state = this.sim.state
    this.teamList.setItems(state.staff)
    this.candidateList.setItems(staffCandidates(this.sim.content, state))

    const teamIndex = Math.max(0, state.staff.findIndex((member) => member.id === this.selectedStaffId))
    this.teamList.setSelectedIndex(teamIndex, false)
    this.selectedStaffId = state.staff[teamIndex]?.id ?? null

    const candidates = staffCandidates(this.sim.content, state)
    const candidateIndex = Math.max(0, candidates.findIndex((candidate) => candidate.id === this.selectedCandidateId))
    this.candidateList.setSelectedIndex(candidateIndex, false)
    this.selectedCandidateId = candidates[candidateIndex]?.id ?? null

    this.refresh()
  }

  private effectText(roleId: string, skill: number): string {
    const content = this.sim.content
    const role = findStaffRole(content, roleId)
    const balance = content.balance
    if (role.qa) {
      const reduction = Math.min(balance.qaBugReductionMax, skill * balance.qaBugReductionPerSkill)
      return `EFFECT   -${Math.round(reduction * 100)}% BUGS · +${(skill * balance.qaCategoryBonus).toFixed(2)} ALL SCORES`
    }
    return `EFFECT   +${skill * balance.staffPointsPerSkill} DEV/WEEK · +${(skill * balance.staffCategoryBonus).toFixed(2)} ${role.category?.toUpperCase()}`
  }

  private refresh(): void {
    const state = this.sim.state
    const content = this.sim.content
    const capacity = staffCapacity(content, state)
    const tier = officeTier(content, state.officeLevel)
    const date = dateOf(this.sim)

    this.infoText.setText(
      `CASH $${Math.round(state.cash).toLocaleString('en-US')} · BURN $${weeklyCostFor(content, state).toLocaleString('en-US')}/W · DEV ${pointsPerWeekFor(content, state)} PTS/W · STAFF ${state.staff.length}/${capacity} · OFFICE ${tier.name} (L${tier.level}) · ${date.year}`,
    )

    const member = state.staff.find((entry) => entry.id === this.selectedStaffId)
    if (member) {
      const role = findStaffRole(content, member.roleId)
      this.teamDetail.setText(
        [
          `${member.name} · ${role.name}`,
          `SKILL    ${stars(member.skill)}`,
          `SALARY   $${member.salary.toLocaleString('en-US')}/W`,
          `HIRED    WEEK ${member.hiredWeek}`,
          this.effectText(member.roleId, member.skill),
        ].join('\n'),
      )
    } else {
      this.teamDetail.setText('NOBODY HIRED YET — CANDIDATES ARE ON THE RIGHT')
    }
    this.fireButton.setEnabled(Boolean(member))

    const candidate = staffCandidates(content, state).find((entry) => entry.id === this.selectedCandidateId)
    if (candidate) {
      const role = findStaffRole(content, candidate.roleId)
      this.candidateDetail.setText(
        [
          `${candidate.name} · ${role.name}`,
          `SKILL    ${stars(candidate.skill)}`,
          `SALARY   $${candidate.salary.toLocaleString('en-US')}/W`,
          `HIRE FEE $${candidate.hireFee.toLocaleString('en-US')}`,
          this.effectText(candidate.roleId, candidate.skill),
        ].join('\n'),
      )
    } else {
      this.candidateDetail.setText('NO CANDIDATES AVAILABLE')
    }

    const full = state.staff.length >= capacity
    this.hireButton.setEnabled(
      Boolean(candidate) && !full && Boolean(candidate && state.cash >= candidate.hireFee) && state.phase !== 'over',
    )
    this.hireButton.setLabel(full ? 'OFFICE FULL' : 'HIRE')

    const canUpgrade = state.officeLevel < maxOfficeLevel(content)
    const nextTier = canUpgrade ? officeTier(content, state.officeLevel + 1) : null
    this.upgradeButton.setLabel(
      nextTier ? `UPGRADE $${nextTier.upgradeCost.toLocaleString('en-US')}` : 'MAX OFFICE',
    )
    this.upgradeButton.setEnabled(Boolean(nextTier) && state.cash >= (nextTier?.upgradeCost ?? 0) && state.phase !== 'over')
  }

  private hire(): void {
    if (!this.selectedCandidateId) return
    try {
      hireStaff(this.sim, this.selectedCandidateId)
      playSfx(this, 'select')
      this.refreshLists()
    } catch (error) {
      playSfx(this, 'error')
      this.candidateDetail.setText((error as Error).message.toUpperCase())
    }
  }

  private fire(): void {
    if (!this.selectedStaffId) return
    try {
      fireStaff(this.sim, this.selectedStaffId)
      playSfx(this, 'back')
      this.selectedStaffId = null
      this.refreshLists()
    } catch (error) {
      playSfx(this, 'error')
      this.teamDetail.setText((error as Error).message.toUpperCase())
    }
  }

  private upgrade(): void {
    try {
      upgradeOffice(this.sim)
      playSfx(this, 'success')
      this.refreshLists()
    } catch (error) {
      playSfx(this, 'error')
      this.infoText.setText((error as Error).message.toUpperCase())
    }
  }

  private close(): void {
    this.scene.stop()
    this.scene.resume('Office')
  }
}
