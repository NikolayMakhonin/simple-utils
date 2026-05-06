import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import type { Unsubscribe } from 'src/common/types'

export class AbortSignalCombined implements IAbortSignalFast {
  private readonly _abortController: AbortControllerFast =
    new AbortControllerFast()
  private _subscriptionCount: number = 0
  private _unsubscribes: Unsubscribe[] | null = null
  private readonly _abortSignals: (IAbortSignalFast | null | undefined)[]
  private readonly _onAbort: (reason: any) => void

  constructor(...abortSignals: (IAbortSignalFast | null | undefined)[]) {
    this._abortSignals = abortSignals
    this._onAbort = reason => {
      this.onAbort(reason)
    }
  }

  private updateAborted() {
    if (this._abortController.signal.aborted) {
      return true
    }
    if (this._subscriptionCount === 0) {
      for (let i = 0; i < this._abortSignals.length; i++) {
        const abortSignal = this._abortSignals[i]
        if (abortSignal != null && abortSignal.aborted) {
          this._abortController.abort(abortSignal.reason)
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
    return this._abortController.signal.reason
  }

  throwIfAborted() {
    this.updateAborted()
    this._abortController.signal.throwIfAborted()
  }

  private unsubscribeAll() {
    if (this._unsubscribes == null) {
      return
    }
    const unsubscribes = this._unsubscribes
    this._unsubscribes = null
    for (let i = 0, len = unsubscribes.length; i < len; i++) {
      unsubscribes[i]()
    }
  }

  private subscribeAll() {
    this._unsubscribes = []
    for (let i = 0; i < this._abortSignals.length; i++) {
      if (this._unsubscribes == null) {
        break
      }
      const abortSignal = this._abortSignals[i]
      if (abortSignal == null) {
        continue
      }
      this._unsubscribes.push(abortSignal.subscribe(this._onAbort))
    }
  }

  private onAbort(reason: any) {
    this.unsubscribeAll()
    this._abortController.abort(reason)
  }

  subscribe(callback: (reason?: any) => void): Unsubscribe {
    if (this.aborted) {
      return this._abortController.signal.subscribe(callback)
    }

    this._subscriptionCount++
    if (this._subscriptionCount === 1) {
      this.subscribeAll()
    }

    const unsubscribe: Unsubscribe =
      this._abortController.signal.subscribe(callback)

    let unsubscribed = false

    return () => {
      if (unsubscribed) {
        return
      }
      unsubscribed = true
      unsubscribe()
      this._subscriptionCount--
      if (this._subscriptionCount === 0) {
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
