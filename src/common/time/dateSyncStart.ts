import { AbortControllerFast } from '@flemist/abort-controller-fast'
import type { TaskOptionsBase } from 'src/common/task/TaskBase'
import { createTaskRepeated } from 'src/common/task/TaskRepeated'
import type { NumberRange, Unsubscribe } from 'src/common/types'
import type { GetDateInetOptions } from './getDateInet'
import { getDateInetRange } from './getDateInetRange'
import {
  type ClockDateReal,
  clockDateReal as clockDateRealDefault,
} from './clock-date'

// An hour: between syncs clockDateReal.value() drifts by a fraction of a second per hour.
// That is less than the 1-second precision of internet time
const DATE_SYNC_INTERVAL = 60 * 60 * 1000

// A minute: when the page ends without being hidden, such as on a crash,
// the stored dateMinimum lags the end of the page by at most a minute
const CLOCK_DATE_REAL_SAVE_INTERVAL = 60 * 1000

// A second: after a device clock set forward, clockDateReal.value() stays ahead
// for at most a second before a measurement starts
const CLOCK_DATE_REAL_CHECK_INTERVAL = 1000

/** The state of a ClockDateReal for a restart */
export type DateSyncStored = {
  offset: number
  dateMinimum: number | null
}

export type DateSyncStartOptions = {
  dateInetOptions?: null | Omit<GetDateInetOptions, 'abortSignal'>
  /** The widest accepted range of real time. A wider range still updates clockDateReal, and the measurement repeats */
  rangeWidthMaximum: number
  /** Keeps the state for a restart */
  save: (stored: DateSyncStored) => void
  /**
   * Called after every measurement of internet time, never at start.
   * error is null after a successful measurement, else the reason why it failed:
   * the time server did not answer, or the range of its answer is wider than rangeWidthMaximum
   */
  onMeasure?: null | ((error: unknown) => void)
  logFuncError?: TaskOptionsBase['logFuncError']
  /** Default: clockDateReal */
  clockDateReal?: null | ClockDateReal
}

/**
 * Keeps clockDateReal on internet time in the background, and gives its state to save for a restart.
 * Restore a saved state through clockDateReal.updateOffset before the program first reads the clock,
 * because a reading before it gives the device clock
 */
export function dateSyncStart(options: DateSyncStartOptions): Unsubscribe {
  const clockDateReal = options.clockDateReal ?? clockDateRealDefault

  function saveClockDateReal() {
    const offset = clockDateReal.offset
    if (offset != null) {
      options.save({ offset, dateMinimum: clockDateReal.dateMinimum })
    }
  }

  let lastRangeWidth: number | null = null

  const dateSyncAbortController = new AbortControllerFast()

  const dateSyncTask = createTaskRepeated(
    async (_, { abortSignal }) => {
      // The catch covers exclusively the request, so that an error thrown by save or by onMeasure itself
      // fails the task without reaching onMeasure as a failed measurement
      let range: NumberRange
      try {
        range = await getDateInetRange({
          ...options.dateInetOptions,
          abortSignal,
        })
      } catch (error) {
        if (!abortSignal.aborted) {
          options.onMeasure?.(error)
        }
        throw error
      }
      clockDateReal.updateDate(range)
      const rangeWidth = range[1] - range[0]
      lastRangeWidth = rangeWidth
      saveClockDateReal()
      // A wider range has still updated clockDateReal, and the throw makes the task measure again
      if (rangeWidth > options.rangeWidthMaximum) {
        const error = new Error(
          `[dateSyncStart] range of internet time (${rangeWidth} ms) is wider than rangeWidthMaximum (${options.rangeWidthMaximum} ms)`,
        )
        options.onMeasure?.(error)
        throw error
      }
      options.onMeasure?.(null)
    },
    null,
    {
      // Each attempt is a run of this task, never a retry inside a run (withRetry).
      // run() called during a run returns the promise of that run.
      // So syncDateNow() could not cut short the wait between retries inside a run
      repeatStrategy: () => ({
        delay: status => {
          if (!status.lastFailedRuns) {
            return DATE_SYNC_INTERVAL
          }
          // The delay doubles from 1 second, for a short failure of the network, up to 10 seconds.
          // So the next measurement comes within 10 seconds after the network returns
          return Math.min(1000 * 2 ** (status.lastFailedRuns - 1), 10_000)
        },
      }),
      abortSignal: dateSyncAbortController.signal,
      logFuncError: options.logFuncError,
    },
  )

  void dateSyncTask.repeated.run()

  function syncDateNow() {
    void dateSyncTask.repeated.run({ immediate: true })
  }

  const unsubscribes: Unsubscribe[] = [() => dateSyncAbortController.abort()]

  if (typeof document !== 'undefined') {
    function onVisibilityChange() {
      if (document.hidden) {
        saveClockDateReal()
      } else {
        syncDateNow()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    unsubscribes.push(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    })
  }

  if (typeof globalThis.addEventListener !== 'undefined') {
    globalThis.addEventListener('online', syncDateNow)
    unsubscribes.push(() => {
      globalThis.removeEventListener('online', syncDateNow)
    })
  }

  const clockDateRealSaveTimer = setInterval(
    saveClockDateReal,
    CLOCK_DATE_REAL_SAVE_INTERVAL,
  )
  unsubscribes.push(() => {
    clearInterval(clockDateRealSaveTimer)
  })

  // After a sleep or a device clock set forward, Date.now() jumps ahead.
  // The next reading of clockDateReal.value() adds the jump.
  // A jump past the range of the last measurement can come from a wrong device clock.
  // Only a measurement tells it from a sleep
  const clockDateRealCheckTimer = setInterval(() => {
    const dateMinimum = clockDateReal.dateMinimum
    // After a failed measurement, the task repeats it after its own growing delay.
    // A measurement started here would cut that delay short.
    // The status of rerun counts every measurement. The status of repeated counts its whole loop as one run.
    // The + 1 allows for clockDateReal.value() and dateMinimum each rounded down to whole milliseconds
    if (
      !dateSyncTask.rerun.status.lastFailedRuns &&
      lastRangeWidth != null &&
      dateMinimum != null &&
      clockDateReal.value() - dateMinimum > lastRangeWidth + 1
    ) {
      syncDateNow()
    }
  }, CLOCK_DATE_REAL_CHECK_INTERVAL)
  unsubscribes.push(() => {
    clearInterval(clockDateRealCheckTimer)
  })

  return () => {
    for (let i = 0, len = unsubscribes.length; i < len; i++) {
      unsubscribes[i]()
    }
  }
}
