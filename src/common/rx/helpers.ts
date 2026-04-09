import type { IObservable } from './types'

export function isObservable(obj: any): obj is IObservable<any> {
  return (
    obj != null &&
    typeof obj === 'object' &&
    typeof (obj as any).subscribe === 'function'
  )
}
