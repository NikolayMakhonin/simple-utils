import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDateInet } from './getDateInet'

const DATE_HEADER = 'Wed, 01 Jan 2020 00:00:00 GMT'
const DATE_TIME = Date.UTC(2020, 0, 1)

function stubFetch(date: string | null) {
  const fetchStub = vi.fn(
    async (url: string, init: RequestInit) =>
      new Response(null, { headers: date == null ? {} : { date } }),
  )
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

describe('getDateInet', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the time from the date header', async () => {
    stubFetch(DATE_HEADER)
    expect(await getDateInet({ url: 'https://example.test/' })).toBe(DATE_TIME)
  })

  it('never answers from the HTTP cache', async () => {
    const fetchStub = stubFetch(DATE_HEADER)
    await getDateInet({ url: 'https://example.test/' })
    const [url, init] = fetchStub.mock.calls[0]
    expect(url).toBe('https://example.test/')
    expect(init.method).toBe('HEAD')
    expect(init.cache).toBe('no-store')
  })

  it('default url without location', async () => {
    const fetchStub = stubFetch(DATE_HEADER)
    await getDateInet()
    expect(fetchStub.mock.calls[0][0]).toBe('https://google.com')
  })

  it('timeout aborts the request', async () => {
    vi.stubGlobal(
      'fetch',
      (url: string, init: RequestInit) =>
        new Promise((resolve, reject) => {
          init.signal!.addEventListener('abort', () => {
            reject(init.signal!.reason)
          })
        }),
    )
    await expect(
      getDateInet({ url: 'https://example.test/', timeout: 1 }),
    ).rejects.toBeDefined()
  })

  it('errors', async () => {
    stubFetch(null)
    await expect(getDateInet({ url: 'https://example.test/' })).rejects.toThrow(
      /No date header/,
    )

    stubFetch('garbage')
    await expect(getDateInet({ url: 'https://example.test/' })).rejects.toThrow(
      /Invalid date header \(garbage\)/,
    )
  })
})
