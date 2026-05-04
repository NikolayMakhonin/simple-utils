import {
  AbortControllerFast,
  type IAbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import { PromiseOrValue } from 'src/types'
import { combineAbortSignals } from 'src/abort-controller-fast'
import { delay } from 'src/delay'
import { EMPTY_FUNC } from 'src/constants'

export type ThrottledFuncArgs<Args> =
  | [
      args?: null | Args,
      options?: null | {
        throttleTime?: null | number | false
        throttleTimeMax?: null | number | false
      },
    ]
  | [false]

export type ThrottledFunc<Args = never, Result = any> = (
  ...args: ThrottledFuncArgs<Args>
) => Promise<Result | null>

export type ToThrottledArgs<Args, Result> = {
  throttleTimeDefault?: null | number
  throttleTimeMax?: null | number
  func: (
    args?: null | Args,
    options?: null | {
      abortSignal?: null | IAbortSignalFast
    },
  ) => PromiseOrValue<Result>
  skipFirst?: null | boolean
  abortSignal?: null | IAbortSignalFast
  timeController?: null | ITimeController
}

export function toThrottled<Args = never, Result = any>({
  throttleTimeDefault,
  throttleTimeMax,
  func,
  skipFirst,
  abortSignal,
  timeController,
}: ToThrottledArgs<Args, Result>): ThrottledFunc<Args, Result> {
  if (timeController == null) {
    timeController = timeControllerDefault
  }

  let timerAbortController: null | IAbortControllerFast = null
  let timerTargetTime: null | number = null
  let nextCallTime: null | number = null
  let lastCallTime: null | number = null
  let isFirstCall = true
  let throttleTimeCurrent: null | number = null
  let throttleTimeMaxCurrent: null | number = null
  let lastArgs: Args | null = null
  let lastResult: Result | null = null

  function updateThrottleTime(
    throttleTime?: null | number,
    _throttleTimeMax?: null | number | false,
  ) {
    const throttleTimeNew = throttleTime ?? throttleTimeDefault ?? 0
    throttleTimeCurrent =
      throttleTimeCurrent == null
        ? throttleTimeNew
        : Math.min(throttleTimeCurrent, throttleTimeNew)
    throttleTimeMaxCurrent =
      _throttleTimeMax == null
        ? (throttleTimeMax ?? null)
        : _throttleTimeMax === false
          ? null
          : _throttleTimeMax
  }

  function updateNextCallTime() {
    const now = timeController!.now()
    let newNextCallTime = now + throttleTimeCurrent!
    if (lastCallTime == null) {
      lastCallTime = now
    }
    if (throttleTimeMaxCurrent != null) {
      newNextCallTime = Math.min(
        newNextCallTime,
        lastCallTime! + throttleTimeMaxCurrent,
      )
    }
    nextCallTime = newNextCallTime
    if (timerTargetTime != null && nextCallTime <= timerTargetTime) {
      timerAbortController!.abort()
      timerAbortController = null
      timerTargetTime = null
    }
    // console.log('[toThrottled]', {
    //   throttleTimeCurrent,
    //   throttleTimeMaxCurrent,
    //   nextCallTime,
    // })
  }

  function update(
    throttleTime?: null | number,
    _throttleTimeMax?: null | number | false,
  ) {
    updateThrottleTime(throttleTime, _throttleTimeMax)
    updateNextCallTime()
  }

  function getCallTime(now: number) {
    if (throttleTimeCurrent == null) {
      return null
    }

    let callTime = nextCallTime ?? 0

    const callTimeMax =
      throttleTimeMaxCurrent == null
        ? null
        : lastCallTime == null
          ? now + throttleTimeMaxCurrent
          : now + Math.max(0, throttleTimeMaxCurrent - (now - lastCallTime))
    if (callTimeMax != null) {
      callTime = Math.min(callTime, callTimeMax)
    }

    return callTime
  }

  let processPromise: Promise<Result | null> | null = null

  async function _process(abortSignal?: null | IAbortSignalFast) {
    try {
      while (true) {
        while (true) {
          abortSignal?.throwIfAborted()

          const now = timeController!.now()
          timerTargetTime = getCallTime(now)

          if (
            timerTargetTime == null ||
            timerTargetTime <= timeController!.now()
          ) {
            break
          }

          timerAbortController = new AbortControllerFast()
          const timerAbortSignal = combineAbortSignals(
            timerAbortController.signal,
            abortSignal,
          )
          await delay(
            timerTargetTime - now,
            timerAbortSignal,
            timeController!,
          ).catch(EMPTY_FUNC)
        }

        if (timerTargetTime == null) {
          break
        }

        timerTargetTime = null
        throttleTimeCurrent = null
        nextCallTime = null

        if (isFirstCall) {
          isFirstCall = false
          if (skipFirst) {
            lastCallTime = timeController!.now()
            updateNextCallTime()
            continue
          }
        }

        try {
          lastResult = await func(lastArgs!, {
            abortSignal,
          })
        } catch (err) {
          if (typeof process === 'undefined') {
            console.error('[toThrottled]', err)
          }
          throw err
        } finally {
          lastCallTime = timeController!.now()
          updateNextCallTime()
        }
      }
    } finally {
      processPromise = null
    }

    return lastResult
  }

  function process(abortSignal?: null | IAbortSignalFast) {
    if (!processPromise) {
      processPromise = _process(abortSignal)
    }
    return processPromise
  }

  return async function _throttle(
    args?: null | Args | false,
    options?: null | {
      throttleTime?: null | number | false
      throttleTimeMax?: null | number | false
    },
  ): Promise<Result | null> {
    const { throttleTime, throttleTimeMax: _throttleTimeMax } = options ?? {}
    if (args === false || throttleTime === false) {
      throttleTimeCurrent = null
      throttleTimeMaxCurrent = throttleTimeMax ?? null
      return processPromise ?? lastResult
    }
    if (args != null) {
      lastArgs = args
    }
    update(throttleTime, _throttleTimeMax)
    return process(abortSignal)
  }
}
