import { PairingHeap, type PairingNode } from '@flemist/pairing-heap'
import type { IClockTime } from './contracts'

type ClockTimeMockTimer = {
  readonly id: number
  readonly time: number
  readonly handler: () => void
}

function timerLessThan(a: ClockTimeMockTimer, b: ClockTimeMockTimer): boolean {
  return a.time < b.time || (a.time === b.time && a.id < b.id)
}

export class ClockTimeMock
  implements IClockTime<PairingNode<ClockTimeMockTimer>>
{
  readonly #queue: PairingHeap<ClockTimeMockTimer>
  #time: number = 1
  #nextId: number = 0
  #timeUnique: number = 0

  constructor() {
    this.#queue = new PairingHeap<ClockTimeMockTimer>({
      lessThanFunc: timerLessThan,
    })
  }

  get queueSize(): number {
    return this.#queue.size
  }

  get timeNextQueued(): number | null {
    return this.#queue.getMin()?.time ?? null
  }

  addValue(duration: number): void {
    this.setValue(this.#time + duration)
  }

  setValue(time: number): void {
    if (time < this.#time) {
      throw new Error(
        `[ClockTimeMock][setValue] time (${time})` +
          ` should be >= value() (${this.#time})`,
      )
    }

    while (true) {
      const timer = this.#queue.getMin()
      if (timer == null || timer.time > time) {
        break
      }
      this.#queue.deleteMin()
      this.#time = timer.time
      timer.handler()
    }

    this.#time = time
  }

  value(): number {
    return this.#time
  }

  valueUnique(): number {
    const next = Math.max(this.#timeUnique, this.value()) + 1
    this.#timeUnique = next
    return next
  }

  setTimeout(
    handler: () => void,
    timeout: number,
  ): PairingNode<ClockTimeMockTimer> {
    return this.#queue.add(
      Object.freeze({
        id: this.#nextId++,
        time: this.#time + timeout,
        handler,
      }),
    )
  }

  clearTimeout(handle: PairingNode<ClockTimeMockTimer>): void {
    this.#queue.delete(handle)
  }
}
