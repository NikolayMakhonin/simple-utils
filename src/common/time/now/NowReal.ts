import type { NumberRange } from 'src/common/types'
import { type ITimeController, timeControllerDefault } from '../time-controller'
import type { INow } from './contracts'

export type NowRealOptions = {
  /** Counts the time between updates. Default: timeControllerDefault */
  timeController?: null | ITimeController
}

/** Like Date.now(), but can be corrected to real time */
export class NowReal implements INow {
  readonly #timeController: ITimeController
  #nowUnique: number = 0
  /** The base of now(). now() returns #time plus the time counted since #timeMonotonic. Null before the first update */
  #time: number | null = null
  #timeMonotonic: number = 0
  /** Date.now() at the last reading of now() or the last update */
  #readingDate: number = 0
  /** The value of timeController.now() at the same moment as #readingDate */
  #readingMonotonic: number = 0
  #realDateMinimum: number | null = null
  #realDateMinimumMonotonic: number = 0

  constructor(options?: null | NowRealOptions) {
    this.#timeController = options?.timeController ?? timeControllerDefault
  }

  /** Milliseconds that now() adds to Date.now() at this moment, or null before the first update */
  get offset(): number | null {
    if (this.#time == null) {
      return null
    }
    return this.now() - Date.now()
  }

  /** Lower bound of real time from the updates, or null before an update gives one */
  get realDateMinimum(): number | null {
    if (this.#realDateMinimum == null) {
      return null
    }
    return Math.floor(
      this.#realDateMinimum +
        this.#timeController.now() -
        this.#realDateMinimumMonotonic,
    )
  }

  /**
   * Corrects now() by a measured range of real time.
   * If now() lies outside the range, moves it into the range.
   * Sets realDateMinimum to the lower end of the range.
   * Call it right after the measurement, because real time leaves the range while other code runs
   */
  updateRealDate(range: NumberRange): void {
    const [from, to] = range
    const now = this.now()
    this.#setNow(now < from || now > to ? (from + to) / 2 : now)
    this.#realDateMinimum = from
    this.#realDateMinimumMonotonic = this.#timeController.now()
  }

  /**
   * Sets offset and realDateMinimum.
   * After the call, now() is Date.now() plus offset, but not less than realDateMinimum
   */
  updateOffset(offset: number, realDateMinimum: number | null): void {
    if (!Number.isFinite(offset)) {
      throw new Error(
        `[NowReal][updateOffset] offset (${offset}) should be a finite number`,
      )
    }
    if (realDateMinimum != null && !Number.isFinite(realDateMinimum)) {
      throw new Error(
        `[NowReal][updateOffset] realDateMinimum (${realDateMinimum}) should be a finite number or null`,
      )
    }
    const time = Date.now() + offset
    this.#setNow(
      realDateMinimum != null && time < realDateMinimum
        ? realDateMinimum
        : time,
    )
    this.#realDateMinimum = realDateMinimum
    this.#realDateMinimumMonotonic = this.#timeController.now()
  }

  now(): number {
    if (this.#time == null) {
      return Date.now()
    }
    const date = Date.now()
    const monotonic = this.#timeController.now()
    // Date.now() gets ahead of timeController.now() after a sleep that timeController.now() did not count.
    // It also gets ahead after the device clock was set forward. now() cannot tell the two apart.
    // Taking the jump keeps the time of a sleep.
    // After a device clock set forward, the next updateRealDate() brings now() back to real time
    const dateJump =
      date - this.#readingDate - (monotonic - this.#readingMonotonic)
    if (dateJump > DATE_JUMP_MINIMUM) {
      this.#time += dateJump
    }
    this.#readingDate = date
    this.#readingMonotonic = monotonic
    return Math.floor(this.#time + monotonic - this.#timeMonotonic)
  }

  /**
   * Like now(), but greater by at least 1 than now() and than the previous result.
   * If an update sets now() more than 10 minutes below the previous result, the next result is now() + 1
   */
  nowUnique(): number {
    const next = Math.max(this.#nowUnique, this.now()) + 1
    this.#nowUnique = next
    return next
  }

  /** Sets now() to the given time at this moment */
  #setNow(time: number): void {
    const monotonic = this.#timeController.now()
    this.#time = time
    this.#timeMonotonic = monotonic
    this.#readingDate = Date.now()
    this.#readingMonotonic = monotonic
    // After an update moves now() far back, nowUnique() restarts from now().
    // Otherwise nowUnique() would stay above now() by the whole move for as long as this NowReal exists
    if (this.#nowUnique - time > NOW_UNIQUE_AHEAD_MAXIMUM) {
      console.warn(
        `[NowReal][setNow] now() moved back below the last nowUnique() by ${this.#nowUnique - time} ms`,
      )
      this.#nowUnique = 0
    }
  }
}

export const nowReal = /* @__PURE__ */ new NowReal()

// A second: far above the rounding of Date.now() and performance.now().
// Ignoring a smaller jump leaves now() off by at most a second.
// That is the precision of internet time
/** When Date.now() gets ahead of the elapsed time by more than this, it counts as a sleep or a device clock set forward */
export const DATE_JUMP_MINIMUM = 1000

// Ten minutes. An update that moves now() back by more means a wrong device clock, not drift.
// After a smaller move back, nowUnique() stays strictly increasing
/** How far nowUnique() can stay ahead of now() after an update. Beyond it, nowUnique() restarts from now() */
const NOW_UNIQUE_AHEAD_MAXIMUM = 10 * 60 * 1000
