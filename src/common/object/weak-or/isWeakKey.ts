export function isWeakKey(key: unknown): key is object {
  if (key == null) {
    return false
  }
  return typeof key === 'object' || typeof key === 'function'
}
