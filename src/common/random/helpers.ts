import { Random } from './Random'

export function randomFloat(
  rnd: Random,
  from: number,
  toExclusive?: null | number,
): number {
  if (toExclusive == null) {
    toExclusive = from
    from = 0
  }
  const range = toExclusive - from
  if (!(range > 0 && range < Infinity)) {
    throw new Error(
      `[random][randomFloat] toExclusive (${toExclusive}) - from (${from}) must be a finite number > 0`,
    )
  }
  const value = rnd.next() * range + from
  // When range is small relative to from, the sum can round up to toExclusive.
  // Returning from in this case keeps the results uniform.
  // Each result gets the sums that round to it on both sides.
  // No sum is less than from, so without this case from gets half the share
  return value < toExclusive ? value : from
}

export function randomInt(
  rnd: Random,
  from: number,
  toExclusive?: null | number,
): number {
  return Math.floor(randomFloat(rnd, from, toExclusive))
}

export function randomBoolean(
  rnd: Random,
  trueProbability?: null | number,
): boolean {
  return rnd.next() < (trueProbability ?? 0.5)
}

/** Returns -1 when there are no weights or all of them are 0 */
export function randomIndexWeighted(rnd: Random, weights: number[]): number
export function randomIndexWeighted(
  rnd: Random,
  length: number,
  getWeight: (index: number) => number,
): number
export function randomIndexWeighted(
  rnd: Random,
  length: number | number[],
  getWeight?: null | ((index: number) => number),
): number {
  if (Array.isArray(length)) {
    const weights = length
    length = weights.length
    getWeight = index => weights[index]
  }
  if (!getWeight) {
    throw new Error('[random][randomIndexWeighted] getWeight is required')
  }

  let totalWeight = 0
  for (let i = 0; i < length; i++) {
    const weight = getWeight(i)
    if (weight < 0) {
      throw new Error(
        `[random][randomIndexWeighted] weight (${weight}) of index ${i} must not be negative`,
      )
    }
    totalWeight += weight
  }
  if (totalWeight === 0) {
    return -1
  }
  let value = randomFloat(rnd, totalWeight)
  let lastIndex = -1
  for (let i = 0; i < length; i++) {
    const weight = getWeight(i)
    if (weight > 0) {
      value -= weight
      if (value < 0) {
        return i
      }
      lastIndex = i
    }
  }
  // Rounding errors can leave value >= 0 after subtracting all weights.
  // In this case the last index with a positive weight is selected, never a zero weight
  return lastIndex
}

export function randomItem<T>(
  rnd: Random,
  items: Array<T> | ArrayLike<T>,
  remove?: null | false,
): T
export function randomItem<T>(
  rnd: Random,
  items: Array<T>,
  remove?: null | boolean,
): T
export function randomItem<T>(
  rnd: Random,
  items: Array<T> | ArrayLike<T>,
  remove?: null | boolean,
): T {
  const length = items.length
  if (length === 0) {
    throw new Error('[random][randomItem] items is empty')
  }
  const index = randomInt(rnd, length)
  const item = items[index]
  if (remove) {
    const arr = items as Array<T>
    arr[index] = arr[length - 1]
    arr.length = length - 1
  }
  return item
}

export function randomItems<T>(
  rnd: Random,
  items: Array<T> | ArrayLike<T>,
  count: number,
  remove?: null | false,
): T[]
export function randomItems<T>(
  rnd: Random,
  items: Array<T>,
  count: number,
  remove?: null | boolean,
): T[]
export function randomItems<T>(
  rnd: Random,
  items: Array<T> | ArrayLike<T>,
  count: number,
  remove?: null | boolean,
): T[] {
  const result: T[] = []
  for (let i = 0; i < count; i++) {
    result.push(randomItem(rnd, items as Array<T>, remove))
  }
  return result
}

export function randomEnum<EnumType extends Record<string, any>>(
  rnd: Random,
  enumType: EnumType,
  predicate?: null | ((value: EnumType[keyof EnumType]) => boolean),
): EnumType[keyof EnumType] {
  const values: EnumType[keyof EnumType][] = []
  for (const key in enumType) {
    if (Object.prototype.hasOwnProperty.call(enumType, key)) {
      const value = enumType[key]
      // Numeric TypeScript enums contain reverse mapping entries: E[E.A = 0] = 'A'
      const isReverseMapping =
        typeof value === 'string' &&
        typeof enumType[value] === 'number' &&
        String(enumType[value]) === key
      if (!isReverseMapping && (!predicate || predicate(value))) {
        values.push(value)
      }
    }
  }
  return randomItem(rnd, values)
}

export function arrayShuffle<T>(rnd: Random, array: T[]): T[] {
  for (let i = 1, len = array.length; i < len; i++) {
    const j = randomInt(rnd, 0, i + 1)
    if (i !== j) {
      const temp = array[i]
      array[i] = array[j]
      array[j] = temp
    }
  }
  return array
}
