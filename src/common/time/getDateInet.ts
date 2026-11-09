import {
  AbortControllerFast,
  toAbortSignal,
} from '@flemist/abort-controller-fast'

/**
 * Returns the current time in milliseconds from the Date header of a web server response.
 * The result does not depend on the local clock. Its precision is 1 second
 * @param options.url Any url that answers a HEAD request. Never use a url served by a CDN:
 * the Date of a response cached by a CDN can be hours old. In browsers, a url of another
 * origin must expose the Date header (Access-Control-Expose-Headers: Date).
 * Default: location.origin in pages and web workers, https://google.com elsewhere
 * @param options.timeout Milliseconds before the request is aborted. Default: no timeout
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
      // Without it, the browser cache can return a response
      // with the old Date of the original response
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
