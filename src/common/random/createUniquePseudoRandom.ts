const PRIME_NUMBER = 1073741789
export const UNIQUE_PSEUDO_RANDOM_MAX_COUNT = (PRIME_NUMBER >> 2) - 1

/**
 * Very simple algorithm for generating unique pseudo-random numbers in range 0..count-1
 * Some kind of shuffle without extra memory allocation
 */
export function createUniquePseudoRandom(
  count: number = UNIQUE_PSEUDO_RANDOM_MAX_COUNT,
  startFrom?: null | number,
) {
  if (count <= 0) {
    throw new Error(`[random][PseudoRandom] count(${count}) must be > 0`)
  }
  if (count > UNIQUE_PSEUDO_RANDOM_MAX_COUNT) {
    throw new Error(
      `[random][PseudoRandom] count(${count}) must be <= ${UNIQUE_PSEUDO_RANDOM_MAX_COUNT}`,
    )
  }
  if (startFrom == null) {
    startFrom = Math.floor(Math.random() * count)
  }
  if (startFrom >= count) {
    throw new Error(
      `[random][PseudoRandom] startFrom(${startFrom}) must be < count(${count})`,
    )
  }
  let value = startFrom
  return function uniquePseudoRandom() {
    value = (value + PRIME_NUMBER) % count
    return value
  }
}
