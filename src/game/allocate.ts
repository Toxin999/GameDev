import { emptySliders } from '../engine/sim'
import { STAGE_IDS } from '../engine/types'
import type { Content, Sliders } from '../engine/types'

export function allocateSliders(content: Content, genreId: string, budget: number): Sliders {
  const genre = content.genres.find((g) => g.id === genreId)
  if (!genre) throw new Error(`unknown genre: ${genreId}`)

  const raw = STAGE_IDS.map((stage) => ({ stage, exact: genre.ideal[stage] * budget }))
  const sliders = emptySliders()
  let assigned = 0
  for (const { stage, exact } of raw) {
    sliders[stage] = Math.floor(exact)
    assigned += sliders[stage]
  }

  const byRemainder = [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))
  let index = 0
  while (assigned < budget) {
    sliders[byRemainder[index % byRemainder.length]!.stage] += 1
    assigned += 1
    index += 1
  }
  return sliders
}
