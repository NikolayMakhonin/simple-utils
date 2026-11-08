import { describe, it, expect } from 'vitest'
import { isWebWorker } from './helpers'

describe('isWebWorker', () => {
  it('false outside browsers', () => {
    expect(isWebWorker()).toBe(false)
  })
})
