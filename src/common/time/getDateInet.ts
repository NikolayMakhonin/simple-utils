import {
  AbortControllerFast,
  toAbortSignal,
} from '@flemist/abort-controller-fast'

/**
 * Current time in milliseconds from the Date header of a web server response,
 * independent of the local clock
 * @param options.url Any url with available HEAD method; in browsers a cross-origin
 * url must expose the Date header. Default is the current origin in browsers
 * and web workers, https://google.com in other environments
 * @param options.timeout Milliseconds before aborting the request; default is no timeout
 */
export async function getDateInet({
  url,
  timeout,
}: {
  url?: null | string
  timeout?: null | number
} = {}) {
  if (!url) {
    url =
      typeof location !== 'undefined' ? location.origin : 'https://google.com'
  }
  const abortController = new AbortControllerFast()
  const timer = timeout
    ? setTimeout(() => {
        abortController.abort()
      }, timeout)
    : null
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      // A cached response carries the date of the original response, not the current time
      cache: 'no-store',
      signal: toAbortSignal(abortController.signal),
    })
    const dateStr = response.headers.get('date')
    if (!dateStr) {
      throw new Error(
        `[getDateInet] No date header in response: ${response.status} ${url}`,
      )
    }
    const date = new Date(dateStr).getTime()
    if (Number.isNaN(date)) {
      throw new Error(
        `[getDateInet] Invalid date header (${dateStr}) in response: ${response.status} ${url}`,
      )
    }
    return date
  } finally {
    if (timer != null) {
      clearTimeout(timer)
    }
  }
}
