import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { runWithFinally } from 'src/common/async/runWithFinally'
import type { PromiseLikeOrValue, PromiseOrValue } from 'src/common/types'

export function useAbortController<T>(
  func: (abortSignal: IAbortSignalFast) => PromiseLike<T>,
): Promise<T>
export function useAbortController<T>(
  func: (abortSignal: IAbortSignalFast) => PromiseLikeOrValue<T>,
): PromiseOrValue<T>
export function useAbortController<T>(
  func: (abortSignal: IAbortSignalFast) => T,
): T
export function useAbortController<T>(
  func: (abortSignal: IAbortSignalFast) => PromiseLikeOrValue<T>,
): PromiseOrValue<T> {
  const abortController = new AbortControllerFast()
  return runWithFinally(
    null,
    () => func(abortController.signal),
    () => {
      abortController.abort()
    },
  )
}
