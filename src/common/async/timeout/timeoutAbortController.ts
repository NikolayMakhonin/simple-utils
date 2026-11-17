import {
  AbortControllerFast,
  AbortError,
  type IAbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { type IDateTime, dateTimeReal } from 'src/common/time/date-time'

// TODO: write doc comments
export type TimeoutArgs = {
  abortSignal?: null | IAbortSignalFast
  timeout?: null | number
  dateTime?: null | IDateTime
}

// TODO: write doc comments
export function timeoutAbortController(
  args: undefined | null | TimeoutArgs,
): IAbortControllerFast | null {
  if (!args || args.timeout == null) {
    return null
  }
  const abortController = new AbortControllerFast()
  const dateTime = args.dateTime ?? dateTimeReal
  const timer = dateTime.time.setTimeout(() => {
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
    dateTime.time.clearTimeout(timer)
    unsubscribe?.()
  })
  return abortController
}
