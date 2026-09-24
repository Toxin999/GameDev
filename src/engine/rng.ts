export interface Rng {
  next(): number
  range(min: number, max: number): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

export function createRng(seed: string | number): Rng {
  let a = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    range(min, max) {
      return min + this.next() * (max - min)
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1))
    },
    pick(items) {
      return items[Math.floor(this.next() * items.length)]!
    },
  }
}
