export function isPromiseLike(obj: any): obj is PromiseLike<any> {
  if (
    obj != null &&
    typeof obj === 'object' &&
    typeof obj.then === 'function'
  ) {
    return true
  }
  return false
}
