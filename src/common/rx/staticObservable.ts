import type { IObservable } from './types'
import { EMPTY_FUNC } from 'src/common/constants'

/** Emits the value to every subscriber immediately and never changes */
export function staticObservable<T>(value: T): IObservable<T> {
  return {
    subscribe(listener) {
      listener(value)
      return EMPTY_FUNC
    },
  }
}
