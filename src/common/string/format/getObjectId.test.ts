import { describe, it, expect } from 'vitest'
import { getObjectId } from './getObjectId'

describe('getObjectId', () => {
  it('base', () => {
    const obj1 = {}
    const obj2 = {}
    const func = () => {}

    const id1 = getObjectId(obj1)
    const id2 = getObjectId(obj2)
    const id3 = getObjectId(func)

    expect(id2).not.toBe(id1)
    expect(id3).not.toBe(id1)
    expect(id3).not.toBe(id2)

    expect(getObjectId(obj1)).toBe(id1)
    expect(getObjectId(obj2)).toBe(id2)
    expect(getObjectId(func)).toBe(id3)
  })
})
