import type { ITime } from './contracts'

export class TimeReal implements ITime {
  #timeUnique: number = 0

  time(): number {
    return performance.now()
  }

  timeUnique(): number {
    const next = Math.max(this.#timeUnique, this.time()) + 1
    this.#timeUnique = next
    return next
  }

  setTimeout(handler: () => void, timeout: number): any {
    return setTimeout(handler, timeout)
  }

  clearTimeout(handle: any): void {
    clearTimeout(handle)
  }
}

export const timeReal = /* @__PURE__ */ new TimeReal()
