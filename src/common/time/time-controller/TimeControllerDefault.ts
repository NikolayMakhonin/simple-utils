import type { ITimeController } from './contracts'

export type TimeControllerDefaultOptions = {
  offset?: null | number
  offsetDate?: null | number
}

export class TimeControllerDefault implements ITimeController {
  #nowUnique: number = 0
  #offset: number | null = null
  #offsetDate: number | null = null

  constructor(options?: null | TimeControllerDefaultOptions) {
    this.setOffset(options?.offset ?? null, options?.offsetDate ?? null)
  }

  /**
   * Milliseconds that now() and nowUnique() add to Date.now().
   * With null, the offset is unknown, and they add nothing
   */
  get offset(): number | null {
    return this.#offset
  }

  setOffset(offset: number | null, date?: null | number) {
    if (offset != null && !Number.isFinite(offset)) {
      throw new Error(
        `[TimeControllerDefault][setOffset] offset (${offset})` +
          ' should be a finite number or null',
      )
    }
    if (date != null && !Number.isFinite(date)) {
      throw new Error(
        `[TimeControllerDefault][setOffset] date (${date})` +
          ' should be a finite number or null',
      )
    }
    this.#offset = offset
    this.#offsetDate = offset == null ? null : (date ?? this.now())
  }

  /**
   * Time of now() when the offset was changed.
   * With null, the time of the measurement is unknown
   */
  get offsetDate(): number | null {
    return this.#offsetDate
  }

  now(): number {
    return Math.max(this.#nowUnique, Date.now() + (this.#offset ?? 0))
  }

  nowUnique(): number {
    const next = this.now() + 1
    this.#nowUnique = next
    return next
  }

  setTimeout(handler: () => void, timeout: number): any {
    return setTimeout(handler, timeout)
  }

  clearTimeout(handle: any): void {
    clearTimeout(handle)
  }
}

export const timeControllerDefault = /* @__PURE__ */ new TimeControllerDefault()
