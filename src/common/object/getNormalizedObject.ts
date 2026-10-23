import { isPlainObject } from './isPlainObject'
import { setOwnProperty } from './setOwnProperty'

// TODO: Add options, disable sort by default
/**
 * Copies plain objects and arrays recursively, sorting the keys of plain objects
 * and removing their properties with null or undefined values
 * Returns other values, including class instances, as is
 */
export function getNormalizedObject<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(getNormalizedObject) as any
  }
  if (!isPlainObject(obj)) {
    return obj
  }

  const result: Record<string, unknown> = {}
  const keys = Object.keys(obj).sort()
  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i]
    const value = getNormalizedObject(obj[key])
    if (value != null) {
      // && value !== '') {
      setOwnProperty(result, key, value)
    }
  }
  return result as T
}
