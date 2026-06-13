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
    if (abortSignal?.aborted) {
      _reject(abortSignal.reason)
      return
    }
    const unsubscribeAbort = abortSignal?.subscribe(_reject)

    // eslint-disable-next-line prefer-const
    let unsubscribeObservable: Unsubscribe | null | undefined
    function _resolve(value: T) {
      unsubscribeAbort?.()
      unsubscribeObservable?.()
      resolved = true
      resolve(value)
    }
    // see: https://github.com/nodejs/node/issues/43655
    // resolve(Promise.reject()) instead of reject() to work around Node.js GC hang on mass rejections;
    // fixed in Node.js >=20.15.0, browsers are not affected
    function _reject(error: any) {
      unsubscribeAbort?.()
      unsubscribeObservable?.()
      resolved = true
      resolve(Promise.reject(error))
    }

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
