import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import {
  timeoutAbortController,
  type TimeoutArgs,
} from './timeoutAbortController'
import type { PromiseLikeOrValue } from 'src/common/types/common'
import { promiseToAbortable } from 'src/common/async/abort/promiseToAbortable'
import { toPromise } from 'src/common/async/promise/toPromise'

/**
 * Like func(abortSignal), but rejects with the reason of the abort when timeout
 * passes or args.abortSignal aborts, also while func ignores the signal.
 * With timeout, the signal that func gets also aborts when withTimeout settles
 */
export async function withTimeout<T>(
  func: (abortSignal: IAbortSignalFast | null) => PromiseLikeOrValue<T>,
  args: undefined | null | TimeoutArgs,
): Promise<T> {
  const abortController = timeoutAbortController(args)
  const abortSignal = abortController?.signal ?? args?.abortSignal ?? null
  try {
    abortSignal?.throwIfAborted()
    return await promiseToAbortable(abortSignal, toPromise(func(abortSignal)))
  } finally {
    abortController?.abort()
  }
}
