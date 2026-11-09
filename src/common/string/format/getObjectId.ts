let nextObjectId = 0
const objectIdMap = new WeakMap<object, number>()

/**
 * Returns a number that identifies the object: the same on every call with this object,
 * different for different objects. The object can still be garbage collected
 */
export function getObjectId(obj: object): number {
  let id = objectIdMap.get(obj)
  if (id == null) {
    id = nextObjectId++
    objectIdMap.set(obj, id)
  }
  return id
}
