import { getNormalizedObject } from 'src/common/object'

export function getJsonKey<T>(obj: T) {
  obj = getNormalizedObject(obj)
  return JSON.stringify(obj ?? null)
}
