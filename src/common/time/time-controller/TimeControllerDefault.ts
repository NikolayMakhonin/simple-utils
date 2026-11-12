import type { ITimeController } from './contracts'

export type TimeControllerDefaultOptions = {
  offset?: null | number
}

export class TimeControllerDefault implements ITimeController {
  #nowUnique: number = 0
  #offset: number | null

  constructor(options?: null | TimeControllerDefaultOptions) {
    this.#offset = options?.offset ?? null
  }

  /**
   * Milliseconds that now() and nowUnique() add to Date.now()
   * With null, the offset is unknown, and they add nothing
   */
  get offset(): number | null {
    return this.#offset
  }

  set offset(value: number | null) {
    this.#offset = value
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
