import { AbortControllerFast } from '@flemist/abort-controller-fast'
import type { TaskOptionsBase } from 'src/common/task/TaskBase'
import { createTaskRepeated } from 'src/common/task/TaskRepeated'
import type { Unsubscribe } from 'src/common/types'
import type { GetDateInetOptions } from './getDateInet'
import { getDateInetRange } from './getDateInetRange'
import { type DateReal, dateReal as dateRealDefault } from './date'

// An hour: between syncs dateReal.now() drifts by a fraction of a second per hour.
// That is less than the 1-second precision of internet time
const TIME_SYNC_INTERVAL = 60 * 60 * 1000

// A minute: when the page ends without being hidden, such as on a crash,
// the stored realDateMinimum lags the end of the page by at most a minute
const DATE_REAL_SAVE_INTERVAL = 60 * 1000

// A second: after a device clock set forward, dateReal.now() stays ahead
// for at most a second before a measurement starts
const DATE_REAL_CHECK_INTERVAL = 1000

/** The state that restores a DateReal after a restart */
export type DateSyncStored = {
  offset: number
  realDateMinimum: number | null
}

export type DateSyncStartOptions = {
  dateInetOptions?: null | Omit<GetDateInetOptions, 'abortSignal'>
  /** The widest accepted range of real time. A wider range still updates dateReal, and the measurement repeats */
  rangeWidthMaximum: number
  /** Returns the state that save kept, or null */
  load: () => DateSyncStored | null
  /** Keeps the state for load to return after a restart */
  save: (stored: DateSyncStored) => void
  /**
   * Called with null at start and after every successful measurement.
   * Called with the error of every failed measurement, also when its range is wider than rangeWidthMaximum
   */
  onUpdate?: null | ((error: unknown) => void)
  logFuncError?: TaskOptionsBase['logFuncError']
  /** Default: dateReal */
  dateReal?: null | DateReal
}

/**
 * Keeps dateReal on internet time,
 * and keeps its state across restarts through load and save
 */
export function dateSyncStart(options: DateSyncStartOptions): Unsubscribe {
  const dateReal = options.dateReal ?? dateRealDefault
  const stored = options.load()
  if (stored != null) {
    dateReal.updateOffset(stored.offset, stored.realDateMinimum)
  }
  options.onUpdate?.(null)

  function saveDateReal() {
    const offset = dateReal.offset
    if (offset != null) {
      options.save({ offset, realDateMinimum: dateReal.realDateMinimum })
    }
  }

  let lastRangeWidth: number | null = null

  const timeSyncAbortController = new AbortControllerFast()

  const timeSyncTask = createTaskRepeated(
    async (_, { abortSignal }) => {
      try {
        const range = await getDateInetRange({
          ...options.dateInetOptions,
          abortSignal,
        })
        dateReal.updateRealDate(range)
        const rangeWidth = range[1] - range[0]
        lastRangeWidth = rangeWidth
        saveDateReal()
        // A wider range has still updated dateReal, and the throw makes the task measure again
        if (rangeWidth > options.rangeWidthMaximum) {
          throw new Error(
            `[dateSyncStart] range of internet time (${rangeWidth} ms) is wider than rangeWidthMaximum (${options.rangeWidthMaximum} ms)`,
          )
        }
        options.onUpdate?.(null)
      } catch (error) {
        if (!abortSignal.aborted) {
          options.onUpdate?.(error)
        }
        throw error
      }
    },
    null,
    {
      // Each attempt is a run of this task, never a retry inside a run (withRetry).
      // run() called during a run returns the promise of that run.
      // So syncTimeNow() could not cut short the wait between retries inside a run
      repeatStrategy: () => ({
        delay: status => {
          if (!status.lastFailedRuns) {
            return TIME_SYNC_INTERVAL
          }
          // The delay doubles from 1 second, for a short failure of the network, up to 10 seconds.
          // So the next measurement comes within 10 seconds after the network returns
          return Math.min(1000 * 2 ** (status.lastFailedRuns - 1), 10_000)
        },
      }),
      abortSignal: timeSyncAbortController.signal,
      logFuncError: options.logFuncError,
    },
  )

  void timeSyncTask.repeated.run()

  function syncTimeNow() {
    void timeSyncTask.repeated.run({ immediate: true })
  }

  const unsubscribes: Unsubscribe[] = [() => timeSyncAbortController.abort()]

  if (typeof document !== 'undefined') {
    function onVisibilityChange() {
      if (document.hidden) {
        saveDateReal()
      } else {
        syncTimeNow()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    unsubscribes.push(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    })
  }

  if (typeof globalThis.addEventListener !== 'undefined') {
    globalThis.addEventListener('online', syncTimeNow)
    unsubscribes.push(() => {
      globalThis.removeEventListener('online', syncTimeNow)
    })
  }

  const dateRealSaveTimer = setInterval(saveDateReal, DATE_REAL_SAVE_INTERVAL)
  unsubscribes.push(() => {
    clearInterval(dateRealSaveTimer)
  })

  // After a sleep or a device clock set forward, Date.now() jumps ahead.
  // The next reading of dateReal.now() adds the jump.
  // A jump past the range of the last measurement can come from a wrong device clock.
  // Only a measurement tells it from a sleep
  const dateRealCheckTimer = setInterval(() => {
    const realDateMinimum = dateReal.realDateMinimum
    // After a failed measurement, the task repeats it after its own growing delay.
    // A measurement started here would cut that delay short.
    // The status of rerun counts every measurement. The status of repeated counts its whole loop as one run.
    // The + 1 allows for dateReal.now() and realDateMinimum each rounded down to whole milliseconds
    if (
      !timeSyncTask.rerun.status.lastFailedRuns &&
      lastRangeWidth != null &&
      realDateMinimum != null &&
      dateReal.now() - realDateMinimum > lastRangeWidth + 1
    ) {
      syncTimeNow()
    }
  }, DATE_REAL_CHECK_INTERVAL)
  unsubscribes.push(() => {
    clearInterval(dateRealCheckTimer)
  })

  return () => {
    for (let i = 0, len = unsubscribes.length; i < len; i++) {
      unsubscribes[i]()
    }
  }
}
