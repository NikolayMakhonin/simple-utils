import { deepEqualJsonLike } from './deepEqualJsonLike'

/**
 * Common equality function for Map objects
 * Compares two Maps by size and deep equality of values using deepEqualJsonLike
 */
export function deepEqualJsonLikeMap<K, V>(
  a: Map<K, V> | null,
  b: Map<K, V> | null,
): boolean {
  if (a == null || b == null) {
    return (a == null) === (b == null)
  }
  if (a.size !== b.size) {
    return false
  }
  for (const [key, value] of a) {
    if (!deepEqualJsonLike(value, b.get(key))) {
      return false
    }
  }
  return true
}
