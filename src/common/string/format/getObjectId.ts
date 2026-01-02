let prevObjectId = 0
const objectIdMap = new WeakMap<object, number>()

/** @internal */
export function getObjectId(obj: object): number {
  if (objectIdMap.has(obj)) {
    return objectIdMap.get(obj)!
  }
  const id = prevObjectId++
  objectIdMap.set(obj, id)
  return id
}
