import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import {
  timeoutAbortController,
  type TimeoutArgs,
} from './timeoutAbortController'

// TODO: write doc comment
export async function withTimeout<T>(
  func: (abortSignal: IAbortSignalFast | null) => Promise<T>,
  args: undefined | null | TimeoutArgs,
): Promise<T> {
  const abortController = timeoutAbortController(args)
  try {
    return await func(abortController?.signal ?? args?.abortSignal ?? null)
  } finally {
    abortController?.abort()
  }
}
