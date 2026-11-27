import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'

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
