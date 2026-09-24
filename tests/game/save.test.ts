import { describe, expect, it } from 'vitest'
import { content } from '../../src/data/content'
import { availablePlatforms, createSim, releaseGame, startProject, tick } from '../../src/engine/sim'
import { allocateSliders } from '../../src/game/allocate'
import { SAVE_VERSION, deserializeSim, serializeSim } from '../../src/game/save'
import type { Sim } from '../../src/engine/sim'

function freshSim(seed: string): Sim {
  const sim = createSim({ content: structuredClone(content), seed })
  startProject(sim, {
    topicId: 'fantasy',
    genreId: 'rpg',
    platformId: availablePlatforms(sim)[0]!.id,
    sliders: allocateSliders(content, 'rpg', content.balance.sliderBudget),
  })
  return sim
}

function playAWeek(sim: Sim): void {
  tick(sim)
}

describe('save files', () => {
  it('round-trips a session without losing state', () => {
    const sim = freshSim('save-roundtrip')
    for (let i = 0; i < 5; i++) playAWeek(sim)

    const restored = deserializeSim(serializeSim(sim))
    expect(restored).not.toBeNull()
    expect(restored!.state).toEqual(sim.state)
    expect(restored!.rng.getState()).toBe(sim.rng.getState())
  })

  it('keeps the random sequence going after a reload', () => {
    const sim = freshSim('save-continuity')
    for (let i = 0; i < 7; i++) playAWeek(sim)

    const restored = deserializeSim(serializeSim(sim))!
    for (let i = 0; i < 6; i++) {
      playAWeek(sim)
      playAWeek(restored)
    }

    expect(restored.state).toEqual(sim.state)
    expect(restored.rng.getState()).toBe(sim.rng.getState())
  })

  it('round-trips a released game with its sales curve', () => {
    const sim = freshSim('save-release')
    let guard = 0
    while (sim.state.phase !== 'release' && guard++ < 200) playAWeek(sim)
    releaseGame(sim)
    while (!['idle', 'over'].includes(sim.state.phase) && guard++ < 400) playAWeek(sim)

    const restored = deserializeSim(serializeSim(sim))!
    expect(restored.state.released).toHaveLength(1)
    expect(restored.state.released[0]!.weeklyUnits).toHaveLength(content.balance.salesWeeks)
    expect(restored.state.released[0]!.unitsSold).toBeGreaterThan(0)
  })

  it('rejects corrupt, stale or unknown content saves', () => {
    const sim = freshSim('save-invalid')
    const file = JSON.parse(serializeSim(sim)) as { version: number; state: { project: { platformId: string } | null } }

    expect(deserializeSim('not json')).toBeNull()
    expect(deserializeSim(JSON.stringify({ ...file, version: SAVE_VERSION + 1 }))).toBeNull()
    expect(deserializeSim(JSON.stringify({ ...file, rngState: undefined }))).toBeNull()

    if (file.state.project) file.state.project.platformId = 'unknown-platform'
    expect(deserializeSim(JSON.stringify(file))).toBeNull()
  })

  it('restores an idle save', () => {
    const sim = createSim({ content: structuredClone(content), seed: 'idle-save' })
    const restored = deserializeSim(serializeSim(sim))!
    expect(restored.state.phase).toBe('idle')
    expect(restored.state.cash).toBe(content.balance.startCash)
  })
})
