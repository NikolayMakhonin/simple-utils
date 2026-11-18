import { PairingHeap, type PairingNode } from '@flemist/pairing-heap'
import type { ITime } from './contracts'

type TimeMockTimer = {
  readonly id: number
  readonly time: number
  readonly handler: () => void
}

function timerLessThan(a: TimeMockTimer, b: TimeMockTimer): boolean {
  return a.time < b.time || (a.time === b.time && a.id < b.id)
}

export class TimeMock implements ITime<PairingNode<TimeMockTimer>> {
  readonly #queue: PairingHeap<TimeMockTimer>
  #time: number = 1
  #nextId: number = 0
  #timeUnique: number = 0

  constructor() {
    this.#queue = new PairingHeap<TimeMockTimer>({
      lessThanFunc: timerLessThan,
    })
  }

  get queueSize(): number {
    return this.#queue.size
  }

  get timeNextQueued(): number | null {
    return this.#queue.getMin()?.time ?? null
  }

  addTime(duration: number): void {
    this.setTime(this.#time + duration)
  }

  setTime(time: number): void {
    if (time < this.#time) {
      throw new Error(
        `[TimeMock][setTime] time (${time})` +
          ` should be >= time() (${this.#time})`,
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

  time(): number {
    return this.#time
  }

  timeUnique(): number {
    const next = Math.max(this.#timeUnique, this.time()) + 1
    this.#timeUnique = next
    return next
  }

  setTimeout(handler: () => void, timeout: number): PairingNode<TimeMockTimer> {
    return this.#queue.add(
      Object.freeze({
        id: this.#nextId++,
        time: this.#time + timeout,
        handler,
      }),
    )
  }

  clearTimeout(handle: PairingNode<TimeMockTimer>): void {
    this.#queue.delete(handle)
  }
}
