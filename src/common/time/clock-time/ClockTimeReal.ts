import type { IClockTime } from './contracts'

export class ClockTimeReal implements IClockTime {
  #timeUnique: number = 0

  value(): number {
    return performance.now()
  }

  valueUnique(): number {
    const next = Math.max(this.#timeUnique, this.value()) + 1
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

export const clockTimeReal = /* @__PURE__ */ new ClockTimeReal()
