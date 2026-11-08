import { describe, it, expect } from 'vitest'
import { urlGetParams } from './urlGet'

describe('urlGetParams', () => {
  it('reads the url of the page by default', () => {
    expect(urlGetParams().toString()).toBe(
      new URL(location.href).searchParams.toString(),
    )
  })
})
