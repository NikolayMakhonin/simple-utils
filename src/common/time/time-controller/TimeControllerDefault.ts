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
    this.offset = options?.offset ?? null
    this.offsetDate = options?.offsetDate ?? null
  }

  /**
   * Milliseconds that now() and nowUnique() add to Date.now().
   * With null, the offset is unknown, and they add nothing
   */
  get offset(): number | null {
    return this.#offset
  }

  set offset(offset: number | null) {
    if (offset != null && !Number.isFinite(offset)) {
      throw new Error(
        `[TimeControllerDefault][offset] offset (${offset})` +
          ' should be a finite number or null',
      )
    }
    this.#offset = offset
  }

  /**
   * Time of now() when the offset was measured.
   * With null, the time of the measurement is unknown
   */
  get offsetDate(): number | null {
    return this.#offsetDate
  }

  set offsetDate(offsetDate: number | null) {
    if (offsetDate != null && !Number.isFinite(offsetDate)) {
      throw new Error(
        `[TimeControllerDefault][offsetDate] offsetDate (${offsetDate})` +
          ' should be a finite number or null',
      )
    }
    this.#offsetDate = offsetDate
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
