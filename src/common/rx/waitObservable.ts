import type { IObservable } from './types'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { Unsubscribe } from 'src/common/types/common'
import { rejectAsResolve } from '../async'

export function waitObservable<T>(
  observable: IObservable<T>,
  predicate?: null | ((value: T, first: boolean) => boolean | null | undefined),
  abortSignal?: null | IAbortSignalFast,
): Promise<T> {
  return new Promise<T>(resolve => {
    let resolved = false

    // eslint-disable-next-line prefer-const
    let unsubscribeAbort: Unsubscribe | null | undefined
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
      rejectAsResolve(resolve, error)
    }

    if (abortSignal?.aborted) {
      _reject(abortSignal.reason)
      return
    }
    unsubscribeAbort = abortSignal?.subscribe(_reject)

    let first = true
    unsubscribeObservable = observable.subscribe(value => {
      if (resolved) {
        return
      }
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
