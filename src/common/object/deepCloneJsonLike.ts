/**
 * Deep clone simple json like objects.
 * null and undefined are normalized to null.
 * Supported only JSON primitive types.
 */
export function deepCloneJsonLike<T>(value: T): T {
  if (value == null) {
    return null as T
  }

  if (Array.isArray(value)) {
    const length = value.length
    const result: any[] = []
    for (let i = 0; i < length; i++) {
      result.push(deepCloneJsonLike(value[i]))
    }
    return result as T
  }

  if (typeof value === 'object') {
    if (value.constructor && value.constructor !== Object) {
      return value
    }

    const result: Record<string, any> = {}
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = deepCloneJsonLike((value as any)[key])
      }
    }
    return result as T
  }

  return value
}
