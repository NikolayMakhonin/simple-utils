import type { IObservable } from './types'

export function get<T>(observable: IObservable<T>): T | undefined {
  let value: T | undefined
  observable.subscribe(o => {
    value = o
  })()
  return value
}
