import { createRng } from './rng'
import type { Rng } from './rng'
import { REVIEW_CATEGORIES } from './types'
import type {
  Balance,
  Content,
  OfficeTier,
  ReviewCategory,
  SimEvent,
  SimState,
  StaffMember,
  StaffRole,
} from './types'

export interface StaffCandidate {
  id: string
  name: string
  roleId: string
  skill: number
  salary: number
  hireFee: number
}

export interface StaffBonuses {
  categories: Partial<Record<ReviewCategory, number>>
  bugChanceMultiplier: number
}

export function findStaffRole(content: Content, roleId: string): StaffRole {
  const role = content.staff.roles.find((entry) => entry.id === roleId)
  if (!role) throw new Error(`unknown staff role: ${roleId}`)
  return role
}

export function officeTier(content: Content, level: number): OfficeTier {
  const tier = content.balance.officeTiers.find((entry) => entry.level === level)
  if (!tier) throw new Error(`unknown office level: ${level}`)
  return tier
}

export function maxOfficeLevel(content: Content): number {
  return content.balance.officeTiers.reduce((max, tier) => Math.max(max, tier.level), 1)
}

export function staffCapacity(content: Content, state: SimState): number {
  return Math.max(0, officeTier(content, state.officeLevel).desks - 1)
}

export function salaryFor(balance: Balance, skill: number): number {
  return balance.salaryBase + skill * balance.salaryPerSkill
}

export function hireFeeFor(balance: Balance, skill: number): number {
  return salaryFor(balance, skill) * balance.hireFeeWeeks
}

function candidateRng(content: Content, state: SimState): Rng {
  const bucket = Math.floor(state.week / content.balance.weeksPerMonth)
  return createRng(`hire-${bucket}-${state.officeLevel}`)
}

export function staffCandidates(content: Content, state: SimState): StaffCandidate[] {
  const { balance, staff } = content
  const rng = candidateRng(content, state)
  const skillMin = Math.max(1, state.officeLevel - 1)
  const skillMax = Math.min(5, state.officeLevel + balance.candidateSkillSpread)
  const bucket = Math.floor(state.week / balance.weeksPerMonth)

  return Array.from({ length: balance.candidateCount }, (_, index) => {
    const skill = rng.int(skillMin, skillMax)
    const role = rng.pick(staff.roles)
    const name = `${rng.pick(staff.names.first)} ${rng.pick(staff.names.last)}`
    return {
      id: `cand-${bucket}-${state.officeLevel}-${index}`,
      name,
      roleId: role.id,
      skill,
      salary: salaryFor(balance, skill),
      hireFee: hireFeeFor(balance, skill),
    }
  })
}

export function weeklyCostFor(content: Content, state: SimState): number {
  const tier = officeTier(content, state.officeLevel)
  const salaries = state.staff.reduce((sum, member) => sum + member.salary, 0)
  return content.balance.weeklyCost + tier.weeklyRent + salaries
}

export function pointsPerWeekFor(content: Content, state: SimState): number {
  const { balance } = content
  const contribution = state.staff.reduce((sum, member) => {
    const role = findStaffRole(content, member.roleId)
    return role.qa ? sum : sum + member.skill * balance.staffPointsPerSkill
  }, 0)
  return Math.round(balance.pointsPerWeek + contribution)
}

export function staffBonuses(content: Content, state: SimState): StaffBonuses {
  const { balance } = content
  const categories: Partial<Record<ReviewCategory, number>> = {}
  let bestQa = 0

  for (const member of state.staff) {
    const role = findStaffRole(content, member.roleId)
    if (role.qa) {
      bestQa = Math.max(bestQa, member.skill)
      continue
    }
    if (!role.category) continue
    const bonus = member.skill * balance.staffCategoryBonus
    categories[role.category] = Math.max(categories[role.category] ?? 0, bonus)
  }

  const qaBonus = bestQa * balance.qaCategoryBonus
  if (qaBonus > 0) {
    for (const category of REVIEW_CATEGORIES) {
      categories[category] = (categories[category] ?? 0) + qaBonus
    }
  }

  const bugChanceMultiplier = 1 - Math.min(balance.qaBugReductionMax, bestQa * balance.qaBugReductionPerSkill)
  return { categories, bugChanceMultiplier }
}

export function hireStaff(sim: { content: Content; state: SimState }, candidateId: string): SimEvent[] {
  const { content, state } = sim
  if (state.phase === 'over') throw new Error('the studio is closed')

  const capacity = staffCapacity(content, state)
  if (state.staff.length >= capacity) throw new Error(`the office is full (${capacity} desks for staff)`)

  const candidate = staffCandidates(content, state).find((entry) => entry.id === candidateId)
  if (!candidate) throw new Error('candidate is no longer available')

  if (state.cash < candidate.hireFee) {
    throw new Error(`not enough cash: need ${candidate.hireFee}`)
  }

  const member: StaffMember = {
    id: candidate.id,
    name: candidate.name,
    roleId: candidate.roleId,
    skill: candidate.skill,
    salary: candidate.salary,
    hiredWeek: state.week,
  }

  state.cash -= candidate.hireFee
  state.staff.push(member)
  return [{ type: 'staff-hired', member }]
}

export function fireStaff(sim: { content: Content; state: SimState }, staffId: string): SimEvent[] {
  const { content, state } = sim
  const index = state.staff.findIndex((member) => member.id === staffId)
  if (index === -1) throw new Error(`unknown staff member: ${staffId}`)

  const member = state.staff[index]!
  const severance = member.salary * content.balance.severanceWeeks
  state.cash -= severance
  state.staff.splice(index, 1)
  return [{ type: 'staff-left', member, severance }]
}

export function upgradeOffice(sim: { content: Content; state: SimState }): SimEvent[] {
  const { content, state } = sim
  if (state.phase === 'over') throw new Error('the studio is closed')

  const maxLevel = maxOfficeLevel(content)
  if (state.officeLevel >= maxLevel) throw new Error('this is the largest office available')

  const nextTier = officeTier(content, state.officeLevel + 1)
  if (state.cash < nextTier.upgradeCost) {
    throw new Error(`not enough cash: need ${nextTier.upgradeCost.toLocaleString('en-US')}`)
  }

  state.cash -= nextTier.upgradeCost
  state.officeLevel = nextTier.level
  return [{ type: 'office-upgraded', level: nextTier.level, cost: nextTier.upgradeCost }]
}
