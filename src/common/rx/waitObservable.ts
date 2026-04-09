import type { IObservable } from './types'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { Unsubscribe } from 'src/common/types/common'

export function waitObservable<T>(
  observable: IObservable<T>,
  predicate?: null | ((value: T, first: boolean) => boolean | null | undefined),
  abortSignal?: null | IAbortSignalFast,
): Promise<T> {
  return new Promise<T>(resolve => {
    let resolved = false
    // eslint-disable-next-line prefer-const
    let unsubscribeObservable: Unsubscribe | null | undefined
    function _resolve(value: T) {
      unsubscribeAbort?.()
      unsubscribeObservable?.()
      resolved = true
      resolve(value)
    }
    function _reject(error: any) {
      unsubscribeAbort?.()
      unsubscribeObservable?.()
      resolved = true
      resolve(Promise.reject(error))
    }
    const unsubscribeAbort = abortSignal?.subscribe(_reject)
    let first = true
    unsubscribeObservable = observable.subscribe(value => {
      if (!predicate || predicate(value, first)) {
        _resolve(value)
      }
      first = false
    })
    if (resolved) {
      unsubscribeObservable?.()
    }
  })
}
