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

/** Runs the callback in a new macrotask, so after all queued microtasks */
function runAfterMicrotasks(callback: () => void): void {
  if (typeof setImmediate === 'function') {
    setImmediate(callback)
    return
  }
  // A message, because setTimeout(0) is delayed by 4 ms when nested,
  // and a global setImmediate polyfill would stay in every application bundle with this library
  if (messageChannel == null) {
    messageChannel = new MessageChannel()
    messageChannel.port1.onmessage = () => {
      messageCallbacks.shift()!()
    }
  }
  messageCallbacks.push(callback)
  messageChannel.port2.postMessage(null)
}
