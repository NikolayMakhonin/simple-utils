import type {
  IAbortSignalFast,
  IUnsubscribe,
} from '@flemist/abort-controller-fast'

/**
 * An abort signal that never aborts and counts the callbacks subscribed to it,
 * so that a test can check that code unsubscribes from the signals that it gets
 */
export class AbortSignalMock implements IAbortSignalFast {
  readonly aborted = false
  readonly reason = undefined
  #subscriptionCount = 0

  /** The count of the subscriptions that are not unsubscribed yet */
  get subscriptionCount(): number {
    return this.#subscriptionCount
  }

  throwIfAborted(): void {}

  subscribe(): IUnsubscribe {
    this.#subscriptionCount++
    return () => {
      this.#subscriptionCount--
    }
  }
}
