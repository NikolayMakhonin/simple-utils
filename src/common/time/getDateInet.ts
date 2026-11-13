import {
  type IAbortSignalFast,
  toAbortSignal,
} from '@flemist/abort-controller-fast'
import { timeoutAbortController } from 'src/common/async/timeout'
import type { ITimeController } from 'src/common/time/time-controller'

export type GetDateInetOptions = {
  url?: null | string
  timeout?: null | number
  abortSignal?: null | IAbortSignalFast
  timeController?: null | ITimeController
}

/**
 * Returns the current time in milliseconds from the Date header of a web server response.
 * The result does not depend on the local clock. Its precision is 1 second
 * @param options.url Any url that answers a HEAD request. Never use a url served by a CDN:
 * the Date of a response cached by a CDN can be hours old. In browsers, a url of another
 * origin must allow CORS and expose the Date header (Access-Control-Expose-Headers: Date).
 * Default: location.origin in pages and web workers, https://google.com elsewhere
 * @param options.timeout Milliseconds before the request is aborted. Default: no timeout
 * @param options.abortSignal Aborts the request
 * @param options.timeController Counts the timeout. Default: timeControllerDefault
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
      method: 'HEAD',
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
    const date = new Date(dateStr).getTime()
    if (Number.isNaN(date)) {
      throw new Error(
        `[getDateInet] Invalid date header (${dateStr}) in response from url (${url}); status: ${response.status}`,
      )
    }
    return date
  } finally {
    // Aborting the finished request clears the timer of the timeout
    // and its subscription to options.abortSignal
    timeoutController?.abort()
  }
}
