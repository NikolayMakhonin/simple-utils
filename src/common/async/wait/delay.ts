import {
  type IAbortSignalFast,
  type IUnsubscribe,
} from '@flemist/abort-controller-fast'
import { type IClock, clockReal } from 'src/common/time/clock'
import {
  promiseRejected,
  rejectAsResolve,
} from 'src/common/async/promise/rejectAsResolve'

export function delay(
  milliseconds: number | null | undefined,
  abortSignal?: null | IAbortSignalFast,
  clock?: null | IClock,
): Promise<void> {
  if (milliseconds != null && !Number.isFinite(milliseconds)) {
    throw new TypeError(
      '[delay] milliseconds must be a finite number: ' + milliseconds,
    )
  }
  if (abortSignal && abortSignal.aborted) {
    return promiseRejected(abortSignal.reason)
  }
  if (milliseconds == null || milliseconds <= 0) {
    return Promise.resolve()
  }
  return new Promise<void>(function executor(resolve) {
    let unsubscribe: IUnsubscribe
    function onResolve() {
      if (unsubscribe) {
        unsubscribe()
      }
      resolve()
    }

    const _clock = clock ?? clockReal
    const handle = _clock.time.setTimeout(onResolve, milliseconds)

    if (abortSignal) {
      unsubscribe = abortSignal.subscribe(function abortListener(reason) {
        _clock.time.clearTimeout(handle)
        rejectAsResolve(resolve, reason)
      })
    }
  })
}
