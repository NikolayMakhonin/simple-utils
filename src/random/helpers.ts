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
  if (toExclusive <= from) {
    throw new Error(
      `[random][randomFloat] toExclusive (${toExclusive}) must be greater than from (${from})`,
    )
  }
  return rnd.next() * (toExclusive - from) + from
}

export function randomInt(
  rnd: Random,
  from: number,
  toExclusive?: null | number,
): number {
  return Math.floor(randomFloat(rnd, from, toExclusive!))
}

export function randomBoolean(
  rnd: Random,
  trueProbability?: null | number,
): boolean {
  return rnd.next() < (trueProbability ?? 0.5)
}

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
    totalWeight += getWeight(i)
  }
  if (totalWeight === 0) {
    return -1
  }
  let value = randomFloat(rnd, totalWeight)
  for (let i = 0; i < length; i++) {
    value -= getWeight(i)
    if (value < 0) {
      return i
    }
  }
  return length - 1
}

export function randomItem<T>(rnd: Random, items: ArrayLike<T>): T {
  if (items.length === 0) {
    throw new Error('[random][randomItem] items is empty')
  }
  const index = randomInt(rnd, items.length)
  return items[index]
}

export function randomItems<T>(rnd: Random, items: T[], count: number): T[] {
  if (items.length === 0) {
    throw new Error('[random][randomItems] items is empty')
  }
  const result: T[] = []
  for (let i = 0; i < count; i++) {
    result.push(randomItem(rnd, items))
  }
  return result
}

export function randomEnum<EnumType extends Record<string, any>>(
  rnd: Random,
  enumType: EnumType,
  predicate?: null | ((value: EnumType[keyof EnumType]) => boolean),
): EnumType[keyof EnumType] {
  let values = Object.values(enumType) as EnumType[keyof EnumType][]
  if (predicate) {
    values = values.filter(predicate)
  }
  return randomItem(rnd, values) as EnumType[keyof EnumType]
}
