import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { abortSignalToPromise } from 'src/common/async/abort/abortSignalToPromise'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'

export function waitMicrotasks(
  abortSignalOrPromise?: null | IAbortSignalFast | PromiseLike<any>,
): Promise<void> {
  const waitPromise = new Promise<void>(resolve => {
    runAfterMicrotasks(resolve)
  })
  const promise = isPromiseLike(abortSignalOrPromise)
    ? abortSignalOrPromise
    : abortSignalOrPromise
      ? abortSignalToPromise(abortSignalOrPromise)
      : null
  return promise ? Promise.race([waitPromise, promise]) : waitPromise
}

let messageChannel: MessageChannel | null = null
const messageCallbacks: (() => void)[] = []

/** Calls the callback when no microtasks are left in the queue */
function runAfterMicrotasks(callback: () => void): void {
  if (typeof setImmediate === 'function') {
    setImmediate(callback)
    return
  }
  // MessageChannel, not setTimeout(0): browsers delay nested setTimeout(0) to 4 ms.
  // Not the setimmediate polyfill: it would be added to the bundle of every app
  // that uses this library
  if (messageChannel == null) {
    messageChannel = new MessageChannel()
    messageChannel.port1.onmessage = () => {
      messageCallbacks.shift()!()
    }
  }
  messageCallbacks.push(callback)
  messageChannel.port2.postMessage(null)
}
