export function min(a: number, b: number | null | undefined): number
export function min(a: number | null | undefined, b: number): number
export function min(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null | undefined
export function min(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null | undefined {
  if (a == null) {
    return b as any
  }
  if (b == null) {
    return a as any
  }
  return Math.min(a, b)
}

export function max(a: number, b: number | null | undefined): number
export function max(a: number | null | undefined, b: number): number
export function max(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null | undefined
export function max(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null | undefined {
  if (a == null) {
    return b as any
  }
  if (b == null) {
    return a as any
  }
  return Math.max(a, b)
}

export function minMax(
  value: number,
  min: number | null | undefined,
  max: number | null | undefined,
): number
export function minMax(
  value: number | null | undefined,
  min: number,
  max: number | null | undefined,
): number
export function minMax(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number,
): number
export function minMax(
  value: number | null | undefined,
  _min: number | null | undefined,
  _max: number | null | undefined,
): number | null | undefined
export function minMax(
  value: number | null | undefined,
  _min: number | null | undefined,
  _max: number | null | undefined,
): number | null | undefined {
  return max(min(value, _min), _max)
}
