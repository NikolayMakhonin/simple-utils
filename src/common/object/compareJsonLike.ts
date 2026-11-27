import { isPlainObject } from './isPlainObject'

/**
 * A total order of JSON-like values, as a comparator for Array.prototype.sort.
 * It returns 0 exactly when deepEqualJsonLike returns true,
 * so null and undefined equal an absent property, and the order of keys does not matter.
 * It throws for values without an order: NaN compared with a number,
 * and a class instance compared with an object that is not an array
 */
export function compareJsonLike(a: any, b: any): -1 | 0 | 1 {
  if (a === b) {
    return 0
  }
  if (a == null) {
    return b == null ? 0 : -1
  }
  if (b == null) {
    return 1
  }
  const type = typeof a
  if (type !== typeof b) {
    return type < typeof b ? -1 : 1
  }
  if (type === 'number' && (Number.isNaN(a) || Number.isNaN(b))) {
    throw new Error('[compareJsonLike] NaN has no order')
  }
  if (type !== 'object') {
    return a < b ? -1 : 1
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return -1
    }
    const length = a.length < b.length ? a.length : b.length
    for (let i = 0; i < length; i++) {
      const result = compareJsonLike(a[i], b[i])
      if (result !== 0) {
        return result
      }
    }
    return a.length < b.length ? -1 : a.length > b.length ? 1 : 0
  }
  if (Array.isArray(b)) {
    return 1
  }
  if (!isPlainObject(a) || !isPlainObject(b)) {
    throw new Error(
      `[compareJsonLike] ${Object.prototype.toString.call(isPlainObject(a) ? b : a)} has no order`,
    )
  }
  // The smallest key whose values differ decides, so the order of the keys does not matter;
  // a missing key reads as null
  let minKey: string | null = null
  let minKeyResult: -1 | 0 | 1 = 0
  for (const key in a) {
    if (
      Object.prototype.hasOwnProperty.call(a, key) &&
      (minKey == null || key < minKey)
    ) {
      const result = compareJsonLike(
        a[key],
        Object.prototype.hasOwnProperty.call(b, key) ? b[key] : null,
      )
      if (result !== 0) {
        minKey = key
        minKeyResult = result
      }
    }
  }
  for (const key in b) {
    if (
      Object.prototype.hasOwnProperty.call(b, key) &&
      !Object.prototype.hasOwnProperty.call(a, key) &&
      (minKey == null || key < minKey)
    ) {
      const result = compareJsonLike(null, b[key])
      if (result !== 0) {
        minKey = key
        minKeyResult = result
      }
    }
  }
  return minKeyResult
}
