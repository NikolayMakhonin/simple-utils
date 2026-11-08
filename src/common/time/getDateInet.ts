import {
  AbortControllerFast,
  toAbortSignal,
} from '@flemist/abort-controller-fast'

/**
 * Current time in milliseconds from the Date header of a web server response,
 * independent of the local clock, with a precision of 1 second
 * @param options.url Any url with available HEAD method. Never use a url served by a CDN,
 * because the Date of its cached response can be hours old. In browsers a cross-origin url
 * must expose the Date header. Default is the current site in browsers and web workers;
 * other environments have no current site, so there the default is https://google.com
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
      // A response from the browser cache carries the date of the original response
      cache: 'no-store',
      signal: toAbortSignal(abortController.signal),
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
    if (timer != null) {
      clearTimeout(timer)
    }
  }
}
