import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { runWithFinally } from 'src/common/async/runWithFinally'

export function useAbortController<T>(
  func: (abortSignal: IAbortSignalFast) => T,
): T {
  const abortController = new AbortControllerFast()
  return runWithFinally(
    null,
    () => func(abortController.signal),
    () => {
      abortController.abort()
    },
  )
}
