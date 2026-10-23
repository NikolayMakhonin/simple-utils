import { isPlainObject } from './isPlainObject'

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

  return (
    obj &&
    Object.keys(obj)
      .sort()
      .reduce((a, key) => {
        const value = getNormalizedObject(obj[key])
        if (value != null) {
          // && value !== '') {
          a[key] = value
        }
        return a
      }, {} as any)
  )
}
