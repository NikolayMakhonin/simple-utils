import { isPlainObject } from './isPlainObject'
import { setOwnProperty } from './setOwnProperty'

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

  if (isPlainObject(value)) {
    const result: Record<string, any> = {}
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        setOwnProperty(result, key, deepCloneJsonLike(value[key]))
      }
    }
    return result as T
  }

  return value
}
