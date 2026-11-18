import {
  type IAbortSignalFast,
  toAbortSignal,
} from '@flemist/abort-controller-fast'
import { timeoutAbortController } from 'src/common/async/timeout'
import type { IClock } from 'src/common/time/clock'

export type GetDateInetOptions = {
  /**
   * Every answer of the url must carry its sending time in the Date header,
   * also an answer from the cache of a CDN.
   * In browsers, a url of another origin must expose this header.
   * Default: location.origin in pages and web workers, https://google.com elsewhere
   */
  url?: null | string
  /** Default: HEAD */
  method?: null | 'HEAD' | 'GET'
  /** Milliseconds before the request is aborted. Default: no timeout */
  timeout?: null | number
  abortSignal?: null | IAbortSignalFast
  /** Counts down the timeout. Default: clockReal */
  clock?: null | IClock
}

/**
 * Returns the time of the Date header of a web server response, in milliseconds.
 * The server writes this time in whole seconds while it answers.
 * So at the moment of the return, real time is later by up to 1 second plus the duration of the request.
 * The result does not depend on the device clock
 */
export async function getDateInet(options?: null | GetDateInetOptions) {
  let url = options?.url
  if (!url) {
    url =
      typeof location !== 'undefined' ? location.origin : 'https://google.com'
  }
  const timeoutController = timeoutAbortController(options)
  const abortSignal = timeoutController?.signal ?? options?.abortSignal
  try {
    const response = await fetch(url, {
      method: options?.method ?? 'HEAD',
      // Without it, the browser cache can return a response
      // with the old Date of the original response
      cache: 'no-store',
      signal: abortSignal == null ? null : toAbortSignal(abortSignal),
    })
    const dateStr = response.headers.get('date')
    if (!dateStr) {
      throw new Error(
        `[getDateInet] No date header in response from url (${url}); status: ${response.status}`,
      )
    }
    const dateInet = new Date(dateStr).getTime()
    if (Number.isNaN(dateInet)) {
      throw new Error(
        `[getDateInet] Invalid date header (${dateStr}) in response from url (${url}); status: ${response.status}`,
      )
    }
    return dateInet
  } finally {
    // Aborting the finished request clears the timer of the timeout
    // and its subscription to options.abortSignal
    timeoutController?.abort()
  }
}
