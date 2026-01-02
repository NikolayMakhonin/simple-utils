/**
 * Most fast and very optimized deep equal simple json like objects.
 * null == undefined in this function.
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

  if (typeof a === 'object') {
    if (typeof b !== 'object') {
      return false
    }

    if (a.constructor && a.constructor !== Object) {
      throw new Error(
        `[deepEqual] unexpected behavior: a.constructor (${a.constructor}) !== Object`,
      )
    }
    if (b.constructor && b.constructor !== Object) {
      throw new Error(
        `[deepEqual] unexpected behavior: b.constructor (${b.constructor}) !== Object`,
      )
    }

    for (const key in a) {
      if (Object.prototype.hasOwnProperty.call(a, key)) {
        if (
          !deepEqualJsonLike(
            a[key],
            Object.prototype.hasOwnProperty.call(b, key) ? b[key] : null,
          )
        ) {
          return false
        }
      }
    }
    for (const key in b) {
      if (Object.prototype.hasOwnProperty.call(b, key)) {
        if (
          !Object.prototype.hasOwnProperty.call(a, key) &&
          !deepEqualJsonLike(b[key], null)
        ) {
          return false
        }
      }
    }

    return true
  }

  return false
}
