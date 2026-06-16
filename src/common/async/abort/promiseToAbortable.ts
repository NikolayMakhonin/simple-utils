import {
  type IAbortSignalFast,
  type IUnsubscribe,
} from '@flemist/abort-controller-fast'
import { rejectAsResolve } from 'src/common/async/promise/rejectAsResolve'

export function promiseToAbortable<T>(
  abortSignal: IAbortSignalFast | null | undefined,
  promise: Promise<T>,
): Promise<T> {
  if (!abortSignal) {
    return promise
  }

  return new Promise<T>(function executor(resolve) {
    if (abortSignal.aborted) {
      rejectAsResolve(resolve, abortSignal.reason)
      return
    }

    let unsubscribe: IUnsubscribe | null = null
    function onResolve(value: T) {
      if (unsubscribe) {
        unsubscribe()
      }
      resolve(value)
    }

    let rejected: boolean = false
    function onReject(reason: any) {
      if (rejected) {
        return
      }

      rejected = true

      if (unsubscribe) {
        unsubscribe()
      }

      rejectAsResolve(resolve, reason)
    }

    promise.then(onResolve, onReject)

    unsubscribe = abortSignal.subscribe(onReject)
  })
}
