let nextObjectId = 0
const objectIdMap = new WeakMap<object, number>()

/**
 * Number that identifies the object: the same for each call with this object,
 * different for different objects; does not keep the object in memory
 */
export function getObjectId(obj: object): number {
  let id = objectIdMap.get(obj)
  if (id == null) {
    id = nextObjectId++
    objectIdMap.set(obj, id)
  }
  return id
}
