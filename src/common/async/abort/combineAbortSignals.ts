import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import type { Unsubscribe } from 'src/common/types'

export class AbortSignalCombined implements IAbortSignalFast {
  readonly #abortController: AbortControllerFast = new AbortControllerFast()
  #subscriptionCount: number = 0
  #unsubscribes: Unsubscribe[] | null = null
  readonly #abortSignals: (IAbortSignalFast | null | undefined)[]
  readonly #onAbort: (reason: any) => void

  constructor(...abortSignals: (IAbortSignalFast | null | undefined)[]) {
    this.#abortSignals = abortSignals
    this.#onAbort = reason => {
      this.onAbort(reason)
    }
  }

  private updateAborted() {
    if (this.#abortController.signal.aborted) {
      return true
    }
    if (this.#subscriptionCount === 0) {
      for (let i = 0; i < this.#abortSignals.length; i++) {
        const abortSignal = this.#abortSignals[i]
        if (abortSignal != null && abortSignal.aborted) {
          this.#abortController.abort(abortSignal.reason)
          return true
        }
      }
    }
    return false
  }

  get aborted() {
    return this.updateAborted()
  }

  get reason() {
    this.updateAborted()
    return this.#abortController.signal.reason
  }

  throwIfAborted() {
    this.updateAborted()
    this.#abortController.signal.throwIfAborted()
  }

  private unsubscribeAll() {
    if (this.#unsubscribes == null) {
      return
    }
    const unsubscribes = this.#unsubscribes
    this.#unsubscribes = null
    for (let i = 0, len = unsubscribes.length; i < len; i++) {
      unsubscribes[i]()
    }
  }

  private subscribeAll() {
    this.#unsubscribes = []
    for (let i = 0; i < this.#abortSignals.length; i++) {
      if (this.#unsubscribes == null) {
        break
      }
      const abortSignal = this.#abortSignals[i]
      if (abortSignal == null) {
        continue
      }
      this.#unsubscribes.push(abortSignal.subscribe(this.#onAbort))
    }
  }

  private onAbort(reason: any) {
    this.unsubscribeAll()
    this.#abortController.abort(reason)
  }

  subscribe(callback: (reason?: any) => void): Unsubscribe {
    if (this.aborted) {
      return this.#abortController.signal.subscribe(callback)
    }

    this.#subscriptionCount++
    if (this.#subscriptionCount === 1) {
      this.subscribeAll()
    }

    const unsubscribe: Unsubscribe =
      this.#abortController.signal.subscribe(callback)

    let unsubscribed = false

    return () => {
      if (unsubscribed) {
        return
      }
      unsubscribed = true
      unsubscribe()
      this.#subscriptionCount--
      if (this.#subscriptionCount === 0) {
        this.unsubscribeAll()
      }
    }
  }
}

export function combineAbortSignals(
  ...abortSignals: (IAbortSignalFast | null | undefined)[]
): IAbortSignalFast {
  return new AbortSignalCombined(...abortSignals)
}
