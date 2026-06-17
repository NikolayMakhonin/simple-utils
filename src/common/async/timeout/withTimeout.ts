import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import {
  timeoutAbortController,
  type TimeoutArgs,
} from './timeoutAbortController'
import type { PromiseLikeOrValue } from 'src/common/types/common'

// TODO: write doc comments
export async function withTimeout<T>(
  func: (abortSignal: IAbortSignalFast | null) => PromiseLikeOrValue<T>,
  args: undefined | null | TimeoutArgs,
): Promise<T> {
  const abortController = timeoutAbortController(args)
  const abortSignal = abortController?.signal ?? args?.abortSignal ?? null
  try {
    abortSignal?.throwIfAborted()
    return await func(abortSignal)
  } finally {
    abortController?.abort()
  }
}
