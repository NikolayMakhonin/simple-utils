import { PairingHeap, type PairingNode } from '@flemist/pairing-heap'
import type { ITimeController } from './contracts'

type TimeControllerMockTimer = {
  readonly id: number
  readonly time: number
  readonly handler: () => void
}

function timerLessThan(
  a: TimeControllerMockTimer,
  b: TimeControllerMockTimer,
): boolean {
  return a.time < b.time || (a.time === b.time && a.id < b.id)
}

export class TimeControllerMock
  implements ITimeController<PairingNode<TimeControllerMockTimer>>
{
  readonly #timers: PairingHeap<TimeControllerMockTimer>
  #now: number = 1
  #nowUnique: number = 0
  #nextId: number = 0

  constructor() {
    this.#timers = new PairingHeap<TimeControllerMockTimer>({
      lessThanFunc: timerLessThan,
    })
  }

  get queueSize(): number {
    return this.#timers.size
  }

  get nextQueuedTime(): number | null {
    return this.#timers.getMin()?.time ?? null
  }

  addTime(time: number): void {
    this.setTime(this.#now + time)
  }

  setTime(time: number): void {
    if (time < this.#now) {
      throw new Error(
        `[TimeControllerMock][setTime] time (${time})` +
          ` should be >= now (${this.#now})`,
      )
    }

    while (true) {
      const timer = this.#timers.getMin()
      if (timer == null || timer.time > time) {
        break
      }
      this.#timers.deleteMin()
      this.#now = timer.time
      timer.handler()
    }

    this.#now = time
  }

  now(): number {
    return Math.max(this.#nowUnique, this.#now)
  }

  nowUnique(): number {
    const next = this.now() + 1
    this.#nowUnique = next
    return next
  }

  setTimeout(
    handler: () => void,
    timeout: number,
  ): PairingNode<TimeControllerMockTimer> {
    return this.#timers.add(
      Object.freeze({
        id: this.#nextId++,
        time: this.#now + timeout,
        handler,
      }),
    )
  }

  clearTimeout(handle: PairingNode<TimeControllerMockTimer>): void {
    this.#timers.delete(handle)
  }
}
