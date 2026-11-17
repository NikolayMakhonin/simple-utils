import type { ITimeController } from './contracts'

export class TimeControllerDefault implements ITimeController {
  now(): number {
    return performance.now()
  }

  setTimeout(handler: () => void, timeout: number): any {
    return setTimeout(handler, timeout)
  }

  clearTimeout(handle: any): void {
    clearTimeout(handle)
  }
}

export const timeControllerDefault = /* @__PURE__ */ new TimeControllerDefault()
