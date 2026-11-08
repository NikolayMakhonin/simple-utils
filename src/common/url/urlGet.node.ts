import { describe, it, expect, vi, afterEach } from 'vitest'
import { urlGetParams } from './urlGet'

describe('urlGetParams', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is empty by default without a current url', () => {
    expect(urlGetParams().toString()).toBe('')
  })

  it('reads the current url by default in a web worker, which has no window', () => {
    vi.stubGlobal('location', { href: 'https://example.test/worker.js?a=1' })
    expect(urlGetParams().get('a')).toBe('1')
  })
})
