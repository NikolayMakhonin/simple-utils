// TODO: write doc comment
// TODO: Add options, disable sort by default
export function getNormalizedObject<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(getNormalizedObject) as any
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
