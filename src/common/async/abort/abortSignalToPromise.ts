import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import type { PromiseOrValue } from 'src/common/types'

export type AbortSignalToPromiseOptions = {
  dontThrow?: null | boolean
}

export function abortSignalToPromise(
  abortSignal: IAbortSignalFast | null | undefined,
  options?: null | AbortSignalToPromiseOptions,
): PromiseOrValue<void> {
  return new Promise<void>((resolve, reject) => {
    abortSignal?.subscribe(error => {
      if (options?.dontThrow) {
        resolve()
      } else {
        reject(error)
      }
    })
  })
}

export function promiseToAbortSignal(
  promise: PromiseLike<any>,
): IAbortSignalFast {
  const abortController = new AbortControllerFast()
  promise.then(
    () => {
      abortController.abort()
    },
    error => {
      abortController.abort(error)
    },
  )
  return abortController.signal
}
