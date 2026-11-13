import {
  AbortControllerFast,
  AbortError,
  type IAbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import {
  type ITimeController,
  timeControllerDefault,
} from 'src/common/time/time-controller'

// TODO: write doc comments
export type TimeoutArgs = {
  abortSignal?: null | IAbortSignalFast
  timeout?: null | number
  timeController?: null | ITimeController
}

// TODO: write doc comments
export function timeoutAbortController(
  args: undefined | null | TimeoutArgs,
): IAbortControllerFast | null {
  if (!args || args.timeout == null) {
    return null
  }
  const abortController = new AbortControllerFast()
  const timeController = args.timeController ?? timeControllerDefault
  const timer = timeController.setTimeout(() => {
    abortController.abort(
      new AbortError(
        `[timeoutAbortController] Timeout error: ${args.timeout}ms`,
      ),
    )
  }, args.timeout)
  const unsubscribe = args.abortSignal?.subscribe(reason => {
    abortController.abort(reason)
  })
  abortController.signal.subscribe(() => {
    timeController.clearTimeout(timer)
    unsubscribe?.()
  })
  return abortController
}
