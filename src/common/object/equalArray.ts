/** Simple strict equality check of array items */
export function equalArray(a: any[], b: any[]): boolean {
  const length = a.length
  if (length !== b.length) {
    return false
  }

  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }

  return true
}
