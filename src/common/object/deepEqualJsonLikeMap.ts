import { deepEqualJsonLike } from './deepEqualJsonLike'

/**
 * Common equality function for Map objects
 * Compares two Maps by deep equality of values using deepEqualJsonLike
 * A null or undefined value is equivalent to an absent key
 */
export function deepEqualJsonLikeMap<K, V>(
  a: Map<K, V> | null,
  b: Map<K, V> | null,
): boolean {
  if (a == null || b == null) {
    return (a == null) === (b == null)
  }
  let aCount = 0
  for (const [key, value] of a) {
    if (!deepEqualJsonLike(value, b.get(key))) {
      return false
    }
    if (value != null) {
      aCount++
    }
  }
  // Each counted value of a equals the value of b with the same key,
  // so b has no other non-null values exactly when the counts are equal
  let bCount = 0
  b.forEach(value => {
    if (value != null) {
      bCount++
    }
  })
  return aCount === bCount
}
