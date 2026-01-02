import {
  AbortControllerFast,
  toAbortSignal,
} from '@flemist/abort-controller-fast'

/**
 * TODO: write doc comment
 * url: any url with available HEAD method. Default is "/"
 */
export async function getDateInet({
  url,
  timeout,
}: {
  url?: null | string
  timeout?: null | number
} = {}) {
  if (!url) {
    url = typeof window !== 'undefined' ? '/' : 'https://google.com'
  }
  let timer: any
  try {
    const abortController = new AbortControllerFast()
    timer = timeout
      ? setTimeout(() => {
          abortController.abort()
        }, timeout)
      : null
    const response = await fetch(url, {
      method: 'HEAD',
      signal: toAbortSignal(abortController.signal),
    })
    const dateStr = response.headers.get('date')
    if (!dateStr) {
      throw new Error(
        `[Now][getDateInet] No date header in response: ${response.status} ${url}`,
      )
    }
    const date = new Date(dateStr).getTime()
    return date
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}
