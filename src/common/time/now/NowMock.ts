import { type ITimeController, TimeControllerMock } from '../time-controller'
import type { INow } from './contracts'

export type NowMockOptions = {
  /** Advances now() by the time it counts. Default: now() changes only by setTime() */
  timeController?: null | ITimeController
}

export class NowMock implements INow {
  readonly #timeController: ITimeController
  #time: number = 0
  #timeMonotonic: number
  #nowUnique: number = 0

  constructor(options?: null | NowMockOptions) {
    this.#timeController = options?.timeController ?? new TimeControllerMock()
    this.#timeMonotonic = this.#timeController.now()
  }

  setTime(time: number): void {
    this.#time = time
    this.#timeMonotonic = this.#timeController.now()
  }

  now(): number {
    return this.#time + this.#timeController.now() - this.#timeMonotonic
  }

  nowUnique(): number {
    const next = Math.max(this.#nowUnique, this.now()) + 1
    this.#nowUnique = next
    return next
  }
}
