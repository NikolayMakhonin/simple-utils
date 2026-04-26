import type { IObservable } from './types'

export function get<T>(observable: IObservable<T>): T {
  let value: T = null!
  observable.subscribe(o => {
    value = o
  })()
  return value
}
