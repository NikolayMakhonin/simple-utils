import { describe, it, expect } from 'vitest'
import { deserializeError, serializeError } from './helpers'
import { ErrorSerializedType } from './types'

describe('deserializeError', () => {
  it('restores the properties of an error', () => {
    const error: any = new Error('msg')
    error.code = 5
    const result = deserializeError(serializeError(error))
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('msg')
    expect(result.code).toBe(5)
    expect(result.stack).toBe(error.stack)
  })

  it('__proto__ in props does not change the prototype of the error', () => {
    const result = deserializeError({
      type: ErrorSerializedType.generic,
      error: new Error('msg'),
      props: JSON.parse(
        '{"__proto__": {"polluted": 1, "message": "fake"}, "code": 5}',
      ),
    })
    expect(Object.getPrototypeOf(result)).toBe(Error.prototype)
    expect(result).toBeInstanceOf(Error)
    expect(result.polluted).toBeUndefined()
    expect(result.message).toBe('msg')
    expect(result.code).toBe(5)
    expect(({} as any).polluted).toBeUndefined()
  })
})
