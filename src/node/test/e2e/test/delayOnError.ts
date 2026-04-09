import { delay } from '@flemist/async-utils'

let delayOnErrorPromise: Promise<void> | null = null
let delayOnErrorTime: number | null = null

export function delayOnErrorSet(time: number) {
  delayOnErrorTime = time
}

export function delayOnErrorCall() {
  if (delayOnErrorPromise) {
    return
  }
  const _delayOnErrorTime =
    delayOnErrorTime ||
    (process.env.DELAY_ON_ERROR
      ? parseInt(process.env.DELAY_ON_ERROR as any, 10)
      : 0)
  if (!delayOnErrorTime) {
    return
  }
  console.log(`[test][delayOnError] Delay on error: ${_delayOnErrorTime} ms`)
  delayOnErrorPromise = delay(_delayOnErrorTime)
  return delayOnErrorPromise
}

export function delayOnErrorWait() {
  return delayOnErrorPromise
}
