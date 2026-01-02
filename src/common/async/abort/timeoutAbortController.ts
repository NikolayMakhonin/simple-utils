import {
  AbortControllerFast,
  AbortError,
  type IAbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'

// TODO: write doc comment
export type TimeoutArgs = {
  abortSignal?: null | IAbortSignalFast
  timeout?: null | number
  timeController?: ITimeController
}

// TODO: write doc comment
export function timeoutAbortController(
  args: undefined | null | TimeoutArgs,
): IAbortControllerFast | null {
  if (!args || args.timeout == null) {
    return null
  }
  const abortController = new AbortControllerFast()
  const timeController = args.timeController ?? timeControllerDefault
  if (args.timeout) {
    const timer = timeController.setTimeout(() => {
      abortController.abort(
        new AbortError(
          `[timeoutAbortController] Timeout error: ${args.timeout}ms`,
        ),
      )
    }, args.timeout)
    abortController.signal.subscribe(() => {
      clearTimeout(timer)
    })
  }
  args.abortSignal?.subscribe(reason => {
    abortController.abort(reason)
  })
  return abortController
}
