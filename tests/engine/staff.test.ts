import { describe, expect, it } from 'vitest'
import { content } from '../../src/data/content'
import { createRng } from '../../src/engine/rng'
import { scoreProject } from '../../src/engine/score'
import {
  fireStaff,
  hireFeeFor,
  hireStaff,
  maxOfficeLevel,
  officeTier,
  pointsPerWeekFor,
  salaryFor,
  staffBonuses,
  staffCandidates,
  staffCapacity,
  upgradeOffice,
  weeklyCostFor,
} from '../../src/engine/staff'
import {
  availablePlatforms,
  createSim,
  emptySliders,
  projectWeeks,
  releaseGame,
  startProject,
  tick,
} from '../../src/engine/sim'
import type { Content, GameProject, Sliders, StaffMember } from '../../src/engine/types'
import { deserializeSim, serializeSim } from '../../src/game/save'
import { allocateSliders } from '../../src/game/allocate'
import { clone, grant, playNaiveGame, runUntil } from './helpers'

function member(roleId: string, skill: number): StaffMember {
  return {
    id: `test-${roleId}-${skill}`,
    name: `${roleId.toUpperCase()} TESTER`,
    roleId,
    skill,
    salary: salaryFor(content.balance, skill),
    hiredWeek: 0,
  }
}

function withOffice(sim: ReturnType<typeof createSim>, level: number): void {
  sim.state.officeLevel = level
}

function fixedProject(c: Content, enginePoints = 30): GameProject {
  const sliders: Sliders = { engine: 4, gameplay: 6, story: 2, graphics: 2, sound: 2 }
  const stagePoints = emptySliders()
  for (const stage of Object.keys(stagePoints) as (keyof Sliders)[]) {
    stagePoints[stage] = sliders[stage] * c.balance.pointsPerUnit
  }
  stagePoints.engine = enginePoints
  return {
    topicId: 'fantasy',
    genreId: 'rpg',
    platformId: 'home-pc',
    sliders,
    stagePoints,
    spent: { ...stagePoints },
    spentTotal: Object.values(stagePoints).reduce((a, b) => a + b, 0),
    stage: 'sound',
    weeksSpent: 16,
    bugs: 0,
    cost: 0,
  }
}

describe('staff costs and capacity', () => {
  it('adds rent and salaries to the weekly burn', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'burn' })
    expect(weeklyCostFor(c, sim.state)).toBe(c.balance.weeklyCost)

    sim.state.staff.push(member('programmer', 3))
    expect(weeklyCostFor(c, sim.state)).toBe(c.balance.weeklyCost + salaryFor(c.balance, 3))

    withOffice(sim, 2)
    expect(weeklyCostFor(c, sim.state)).toBe(c.balance.weeklyCost + officeTier(c, 2).weeklyRent + salaryFor(c.balance, 3))

    withOffice(sim, 3)
    expect(weeklyCostFor(c, sim.state)).toBe(c.balance.weeklyCost + officeTier(c, 3).weeklyRent + salaryFor(c.balance, 3))
  })

  it('charges the burn every tick', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'tick-burn' })
    sim.state.staff.push(member('artist', 2))
    withOffice(sim, 2)
    const before = sim.state.cash
    tick(sim)
    expect(sim.state.cash).toBe(before - weeklyCostFor(c, sim.state))
  })

  it('grows staff capacity with the office level', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'capacity' })
    expect(staffCapacity(c, sim.state)).toBe(0)
    withOffice(sim, 2)
    expect(staffCapacity(c, sim.state)).toBe(2)
    withOffice(sim, 3)
    expect(staffCapacity(c, sim.state)).toBe(4)
  })
})

describe('staff contribution', () => {
  it('speeds development for specialists but not for QA', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'speed' })
    expect(pointsPerWeekFor(c, sim.state)).toBe(c.balance.pointsPerWeek)

    sim.state.staff.push(member('designer', 5))
    expect(pointsPerWeekFor(c, sim.state)).toBe(c.balance.pointsPerWeek + 5 * c.balance.staffPointsPerSkill)

    sim.state.staff.push(member('tester', 5))
    expect(pointsPerWeekFor(c, sim.state)).toBe(c.balance.pointsPerWeek + 5 * c.balance.staffPointsPerSkill)
  })

  it('finishes a project in fewer weeks with staff', () => {
    const c = clone()
    const sliders: Sliders = { engine: 4, gameplay: 6, story: 2, graphics: 2, sound: 2 }

    const solo = createSim({ content: c, seed: 'solo' })
    startProject(solo, { topicId: 'space', genreId: 'action', platformId: 'home-pc', sliders })
    runUntil(solo, ['release'], 100)
    const soloWeeks = solo.state.project!.weeksSpent

    const staffed = createSim({ content: c, seed: 'staffed' })
    grant(staffed, 0, 200_000)
    staffed.state.officeLevel = 2
    staffed.state.staff.push(member('programmer', 5), member('designer', 5))
    startProject(staffed, { topicId: 'space', genreId: 'action', platformId: 'home-pc', sliders })
    runUntil(staffed, ['release'], 100)

    expect(staffed.state.project!.weeksSpent).toBeLessThan(soloWeeks)
    expect(projectWeeks(c, sliders, pointsPerWeekFor(c, staffed.state))).toBe(staffed.state.project!.weeksSpent)
  })

  it('boosts only the matching category and never stacks duplicates', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'bonus' })
    sim.state.staff.push(member('artist', 4))
    const single = staffBonuses(c, sim.state)
    expect(single.categories.graphics).toBeCloseTo(4 * c.balance.staffCategoryBonus)
    expect(single.categories.gameplay).toBeUndefined()

    sim.state.staff.push(member('artist', 2))
    const duplicates = staffBonuses(c, sim.state)
    expect(duplicates.categories.graphics).toBeCloseTo(single.categories.graphics!)
  })

  it('gives QA a small bonus everywhere and a capped bug reduction', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'qa' })
    sim.state.staff.push(member('tester', 5))
    const bonuses = staffBonuses(c, sim.state)

    expect(bonuses.categories.gameplay).toBeCloseTo(5 * c.balance.qaCategoryBonus)
    expect(bonuses.categories.tech).toBeCloseTo(5 * c.balance.qaCategoryBonus)
    expect(bonuses.bugChanceMultiplier).toBeCloseTo(1 - c.balance.qaBugReductionMax)

    sim.state.staff.push(member('tester', 5))
    expect(staffBonuses(c, sim.state).bugChanceMultiplier).toBeCloseTo(bonuses.bugChanceMultiplier)
  })

  it('rolls fewer bugs and scores higher with QA on the team', () => {
    const c = clone()
    const sliders: Sliders = { engine: 4, gameplay: 6, story: 2, graphics: 2, sound: 2 }
    const play = (withQa: boolean) => {
      const sim = createSim({ content: c, seed: 'qa-bugs' })
      if (withQa) {
        sim.state.officeLevel = 2
        sim.state.staff.push(member('tester', 5))
      }
      startProject(sim, { topicId: 'space', genreId: 'action', platformId: 'home-pc', sliders })
      runUntil(sim, ['release'], 100)
      return { bugs: sim.state.project!.bugs, review: sim.state.currentReview!.overall }
    }

    const solo = play(false)
    const withQa = play(true)
    expect(withQa.bugs).toBeLessThanOrEqual(solo.bugs)
    expect(withQa.review).toBeGreaterThanOrEqual(solo.review)
  })

  it('raises review scores through the score input', () => {
    const c = clone()
    c.balance.variance = 0
    const project = fixedProject(c)
    const input = {
      project,
      topic: c.topics.find((topic) => topic.id === 'fantasy')!,
      genre: c.genres.find((genre) => genre.id === 'rpg')!,
      platform: c.platforms.find((platform) => platform.id === 'home-pc')!,
      balance: c.balance,
      rng: createRng('staff-score'),
      techLevel: 1,
    }

    const plain = scoreProject(input)
    const buffed = scoreProject({
      ...input,
      rng: createRng('staff-score'),
      staffBonuses: { categories: { graphics: 0.2, tech: 0.1 } },
    })

    expect(buffed.categories.graphics).toBeGreaterThan(plain.categories.graphics)
    expect(buffed.categories.tech).toBeGreaterThan(plain.categories.tech)
    expect(buffed.categories.gameplay).toBe(plain.categories.gameplay)
    expect(buffed.staffBonus.graphics).toBeCloseTo(0.2)
  })

})

describe('hiring, firing and offices', () => {
  it('refuses hires when the garage has no spare desk', () => {
    const sim = createSim({ content: clone(), seed: 'full' })
    grant(sim, 0, 200_000)
    const candidate = staffCandidates(sim.content, sim.state)[0]!
    expect(() => hireStaff(sim, candidate.id)).toThrow(/office is full/)
  })

  it('removes hired people from the candidate pool', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'pool-removal' })
    grant(sim, 0, 200_000)
    upgradeOffice(sim)
    const before = staffCandidates(c, sim.state)
    hireStaff(sim, before[0]!.id)

    const after = staffCandidates(c, sim.state)
    expect(after).toHaveLength(before.length - 1)
    expect(after.some((candidate) => candidate.id === before[0]!.id)).toBe(false)
    expect(() => hireStaff(sim, before[0]!.id)).toThrow(/no longer available/)
  })

  it('hires a candidate for the recruiting fee', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'hire' })
    grant(sim, 0, 200_000)
    upgradeOffice(sim)
    const candidate = staffCandidates(c, sim.state)[0]!
    const before = sim.state.cash
    const events = hireStaff(sim, candidate.id)

    expect(sim.state.staff).toHaveLength(1)
    expect(sim.state.cash).toBe(before - candidate.hireFee)
    expect(sim.state.staff[0]!.name).toBe(candidate.name)
    expect(events.some((event) => event.type === 'staff-hired')).toBe(true)
  })

  it('rejects stale candidates and unpaid hires', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'stale' })
    grant(sim, 0, 200_000)
    upgradeOffice(sim)
    const candidate = staffCandidates(c, sim.state)[0]!
    for (let index = 0; index < c.balance.weeksPerMonth; index++) tick(sim)
    expect(() => hireStaff(sim, candidate.id)).toThrow(/no longer available/)

    const broke = createSim({ content: c, seed: 'broke' })
    broke.state.cash = 10
    broke.state.officeLevel = 2
    const affordable = staffCandidates(c, broke.state)[0]!
    expect(() => hireStaff(broke, affordable.id)).toThrow(/not enough cash/)
  })

  it('fires staff for one week of severance', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'fire' })
    grant(sim, 0, 200_000)
    upgradeOffice(sim)
    const candidate = staffCandidates(c, sim.state)[0]!
    hireStaff(sim, candidate.id)
    const before = sim.state.cash

    const events = fireStaff(sim, candidate.id)
    expect(sim.state.staff).toHaveLength(0)
    expect(sim.state.cash).toBe(before - candidate.salary * c.balance.severanceWeeks)
    expect(events.some((event) => event.type === 'staff-left')).toBe(true)
    expect(() => fireStaff(sim, candidate.id)).toThrow(/unknown staff/)
  })

  it('upgrades the office up to the largest tier', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'office' })
    grant(sim, 0, 200_000)

    upgradeOffice(sim)
    expect(sim.state.officeLevel).toBe(2)
    expect(sim.state.cash).toBe(200_000 + c.balance.startCash - officeTier(c, 2).upgradeCost)

    upgradeOffice(sim)
    expect(sim.state.officeLevel).toBe(maxOfficeLevel(c))
    expect(() => upgradeOffice(sim)).toThrow(/largest office/)
  })

  it('blocks office upgrades the studio cannot afford', () => {
    const sim = createSim({ content: clone(), seed: 'poor-office' })
    sim.state.cash = 100
    expect(() => upgradeOffice(sim)).toThrow(/not enough cash/)
  })
})

describe('candidates', () => {
  it('offers the same people for the same month and office', () => {
    const c = clone()
    const a = createSim({ content: c, seed: 'pool-a' })
    const b = createSim({ content: c, seed: 'pool-b' })
    b.state.week = a.state.week
    expect(staffCandidates(c, a.state)).toEqual(staffCandidates(c, b.state))
  })

  it('rotates the pool every month and improves with the office', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'rotate' })
    const before = staffCandidates(c, sim.state).map((candidate) => candidate.id)
    sim.state.week += c.balance.weeksPerMonth
    const after = staffCandidates(c, sim.state).map((candidate) => candidate.id)
    expect(after).not.toEqual(before)

    withOffice(sim, 3)
    for (const candidate of staffCandidates(c, sim.state)) {
      expect(candidate.skill).toBeGreaterThanOrEqual(2)
      expect(candidate.skill).toBeLessThanOrEqual(5)
      expect(candidate.salary).toBe(salaryFor(c.balance, candidate.skill))
      expect(candidate.hireFee).toBe(hireFeeFor(c.balance, candidate.skill))
    }
  })

  it('produces unique candidate ids with known roles', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'ids' })
    withOffice(sim, 2)
    const candidates = staffCandidates(c, sim.state)
    expect(new Set(candidates.map((candidate) => candidate.id)).size).toBe(candidates.length)
    for (const candidate of candidates) {
      expect(c.staff.roles.some((role) => role.id === candidate.roleId)).toBe(true)
    }
  })
})

describe('staff persistence', () => {
  it('migrates old saves to an empty garage', () => {
    const legacy = JSON.stringify({
      version: 2,
      savedAt: 0,
      rngState: 99,
      state: {
        week: 20,
        cash: 12345,
        fans: 1,
        phase: 'idle',
        outcome: null,
        project: null,
        currentReview: null,
        sales: null,
        released: [],
        researchPoints: 12,
        techLevel: 2,
        unlocked: ['tech-2'],
        research: null,
      },
    })

    const sim = deserializeSim(legacy)
    expect(sim).not.toBeNull()
    expect(sim!.state.staff).toEqual([])
    expect(sim!.state.officeLevel).toBe(1)
    expect(sim!.state.researchPoints).toBe(12)
    expect(sim!.state.techLevel).toBe(2)
  })

  it('round-trips a studio with staff and a bigger office', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'staff-save' })
    grant(sim, 0, 200_000)
    upgradeOffice(sim)
    const candidate = staffCandidates(c, sim.state)[0]!
    hireStaff(sim, candidate.id)

    const restored = deserializeSim(serializeSim(sim))!
    expect(restored.state.staff).toEqual(sim.state.staff)
    expect(restored.state.officeLevel).toBe(sim.state.officeLevel)
    expect(weeklyCostFor(c, restored.state)).toBe(weeklyCostFor(c, sim.state))
  })
})

describe('balance guard', () => {
  it('stays solvent and finishes the run when hiring as the studio grows', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'staff-run' })

    const autopilot = () => {
      if (sim.state.officeLevel < maxOfficeLevel(c) && sim.state.staff.length >= staffCapacity(c, sim.state)) {
        const next = officeTier(c, sim.state.officeLevel + 1)
        if (sim.state.cash > next.upgradeCost + 45000) {
          try {
            upgradeOffice(sim)
          } catch {
            /* not affordable yet */
          }
        }
      }
      const candidates = [...staffCandidates(c, sim.state)].sort((a, b) => a.hireFee - b.hireFee)
      for (const candidate of candidates) {
        if (sim.state.staff.length >= staffCapacity(c, sim.state)) break
        if (sim.state.cash > candidate.hireFee + 30000) {
          try {
            hireStaff(sim, candidate.id)
          } catch {
            /* skip this month */
          }
        }
      }
    }

    for (let game = 0; game < 25 && (sim.state.phase as string) !== 'over'; game++) {
      autopilot()
      const topic = sim.content.topics[0]!
      const genre = sim.content.genres[0]!
      const platform = availablePlatforms(sim).pop()
      if (!platform) break
      startProject(sim, {
        topicId: topic.id,
        genreId: genre.id,
        platformId: platform.id,
        sliders: allocateSliders(c, genre.id, c.balance.sliderBudget),
      })
      runUntil(sim, ['release', 'over'], 200)
      if ((sim.state.phase as string) === 'over') break
      releaseGame(sim)
      runUntil(sim, ['idle', 'over'], 100)
    }

    expect(sim.state.outcome).not.toBe('bankrupt')
    expect(sim.state.outcome).toBe('win')
    expect(sim.state.released.length).toBeGreaterThanOrEqual(4)
    expect(sim.state.released.length).toBeLessThanOrEqual(25)
    expect(sim.state.staff.length).toBeGreaterThan(0)
  })

  it('still supports the naive hirer-less player', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'solo-run' })
    for (let game = 0; game < 6; game++) playNaiveGame(sim, c)
    expect(sim.state.outcome).not.toBe('bankrupt')
    expect(sim.state.staff).toHaveLength(0)
  })
})
