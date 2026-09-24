export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function snapToStep(value: number, min: number, step: number): number {
  if (step <= 0) return value
  return min + Math.round((value - min) / step) * step
}

export function normalizeValue(value: number, min: number, max: number, step: number): number {
  const precision = step > 0 ? Math.max(0, Math.ceil(Math.log10(1 / step))) : 0
  const snapped = snapToStep(clamp(value, min, max), min, step)
  return Number(snapped.toFixed(precision))
}

export function valueToRatio(value: number, min: number, max: number): number {
  if (max === min) return 0
  return clamp((value - min) / (max - min), 0, 1)
}

export function ratioToValue(ratio: number, min: number, max: number, step: number): number {
  return normalizeValue(min + clamp(ratio, 0, 1) * (max - min), min, max, step)
}
