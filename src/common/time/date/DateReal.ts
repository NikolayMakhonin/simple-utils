import type { NumberRange } from 'src/common/types'
import { type ITime, timeReal } from '../time'
import type { IDate } from './contracts'

export type DateRealOptions = {
  /** Counts the time between updates. Default: timeReal */
  time?: null | ITime
}

/** Like Date.now(), but can be corrected to real time */
export class DateReal implements IDate {
  readonly #time: ITime
  #nowUnique: number = 0
  #dateBase: number | null = null
  #timeBase: number = 0
  #dateReading: number = 0
  #timeReading: number = 0
  #realDateMinimum: number | null = null
  #timeRealDateMinimum: number = 0

  constructor(options?: null | DateRealOptions) {
    this.#time = options?.time ?? timeReal
  }

  /** Milliseconds that now() adds to Date.now() at this moment, or null before the first update */
  get offset(): number | null {
    if (this.#dateBase == null) {
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
      this.#realDateMinimum + this.#time.time() - this.#timeRealDateMinimum,
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
    this.#timeRealDateMinimum = this.#time.time()
  }

  /**
   * Sets offset and realDateMinimum.
   * After the call, now() is Date.now() plus offset, but not less than realDateMinimum
   */
  updateOffset(offset: number, realDateMinimum: number | null): void {
    if (!Number.isFinite(offset)) {
      throw new Error(
        `[DateReal][updateOffset] offset (${offset}) should be a finite number`,
      )
    }
    if (realDateMinimum != null && !Number.isFinite(realDateMinimum)) {
      throw new Error(
        `[DateReal][updateOffset] realDateMinimum (${realDateMinimum}) should be a finite number or null`,
      )
    }
    const now = Date.now() + offset
    this.#setNow(
      realDateMinimum != null && now < realDateMinimum ? realDateMinimum : now,
    )
    this.#realDateMinimum = realDateMinimum
    this.#timeRealDateMinimum = this.#time.time()
  }

  now(): number {
    if (this.#dateBase == null) {
      return Date.now()
    }
    const now = Date.now()
    const time = this.#time.time()
    // The time of a sleep must count, and a device clock set forward
    // cannot be told apart from a sleep
    const dateJump = now - this.#dateReading - (time - this.#timeReading)
    if (dateJump > DATE_JUMP_MINIMUM) {
      this.#dateBase += dateJump
    }
    this.#dateReading = now
    this.#timeReading = time
    return Math.floor(this.#dateBase + time - this.#timeBase)
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

  /** Sets now() to the given value at this moment */
  #setNow(now: number): void {
    const time = this.#time.time()
    this.#dateBase = now
    this.#timeBase = time
    this.#dateReading = Date.now()
    this.#timeReading = time
    // After an update moves now() far back, nowUnique() restarts from now().
    // Otherwise nowUnique() would stay above now() by the whole move for as long as this DateReal exists
    if (this.#nowUnique - now > NOW_UNIQUE_AHEAD_MAXIMUM) {
      console.warn(
        `[DateReal][setNow] now() moved back below the last nowUnique() by ${this.#nowUnique - now} ms`,
      )
      this.#nowUnique = 0
    }
  }
}

export const dateReal = /* @__PURE__ */ new DateReal()

// A second: far above the rounding of Date.now() and performance.now().
// Ignoring a smaller jump leaves now() off by at most a second.
// That is the precision of internet time
/** When Date.now() gets ahead of the elapsed time by more than this, it counts as a sleep or a device clock set forward */
export const DATE_JUMP_MINIMUM = 1000

// Ten minutes: an update that moves now() back by more means a wrong device clock, not drift.
// After a smaller move back, nowUnique() stays strictly increasing
/** How far nowUnique() can stay ahead of now() after an update. Beyond it, nowUnique() restarts from now() */
const NOW_UNIQUE_AHEAD_MAXIMUM = 10 * 60 * 1000
