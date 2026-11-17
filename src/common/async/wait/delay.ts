import {
  type IAbortSignalFast,
  type IUnsubscribe,
} from '@flemist/abort-controller-fast'
import { type IDateTime, dateTimeReal } from 'src/common/time/date-time'
import { rejectAsResolve } from 'src/common/async/promise/rejectAsResolve'

export function delay(
  milliseconds: number | null | undefined,
  abortSignal?: null | IAbortSignalFast,
  dateTime?: null | IDateTime,
) {
  if (milliseconds == null) {
    return Promise.resolve()
  }
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError('milliseconds must be a finite number: ' + milliseconds)
  }
  if (milliseconds <= 0) {
    return Promise.resolve()
  }
  return new Promise<void>(function executor(resolve) {
    if (abortSignal && abortSignal.aborted) {
      rejectAsResolve(resolve, abortSignal.reason)
      return
    }

    let unsubscribe: IUnsubscribe
    function onResolve() {
      if (unsubscribe) {
        unsubscribe()
      }
      resolve()
    }

    const _dateTime = dateTime ?? dateTimeReal
    const handle = _dateTime.time.setTimeout(onResolve, milliseconds)

    if (abortSignal) {
      unsubscribe = abortSignal.subscribe(function abortListener(reason) {
        _dateTime.time.clearTimeout(handle)
        rejectAsResolve(resolve, reason)
      })
    }
  })
}
