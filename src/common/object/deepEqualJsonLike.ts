import { isPlainObject } from './isPlainObject'

/**
 * Most fast and very optimized deep equal simple json like objects.
 * null equals undefined, and a property with a null or undefined value equals an absent property.
 * Supported only JSON primitive types.
 */
export function deepEqualJsonLike(a: any, b: any): boolean {
  // Handle identity comparison and null/undefined cases
  if (a === b) {
    return true
  }
  if (a == null) {
    return b == null
  }
  if (b == null) {
    return false
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false
    }

    const length = a.length
    if (length !== b.length) {
      return false
    }

    for (let i = 0; i < length; i++) {
      if (!deepEqualJsonLike(a[i], b[i])) {
        return false
      }
    }

    return true
  }

  if (isPlainObject(a)) {
    if (!isPlainObject(b)) {
      return false
    }

    let aCount = 0
    for (const key in a) {
      if (Object.prototype.hasOwnProperty.call(a, key)) {
        const value = a[key]
        if (
          !deepEqualJsonLike(
            value,
            Object.prototype.hasOwnProperty.call(b, key) ? b[key] : null,
          )
        ) {
          return false
        }
        if (value != null) {
          aCount++
        }
      }
    }
    // Each counted value of a equals the value of b with the same key,
    // so b has no other non-null values exactly when the counts are equal
    let bCount = 0
    for (const key in b) {
      if (Object.prototype.hasOwnProperty.call(b, key) && b[key] != null) {
        bCount++
      }
    }

    return aCount === bCount
  }

  return false
}
