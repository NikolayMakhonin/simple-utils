import { describe, it, expect } from 'vitest'
import { setOwnProperty } from './setOwnProperty'

describe('setOwnProperty', () => {
  it('base', () => {
    const obj: Record<string, unknown> = {}
    setOwnProperty(obj, 'a', 1)
    setOwnProperty(obj, 'b', undefined)
    setOwnProperty(obj, 'a', 2)
    expect(Object.keys(obj)).toEqual(['a', 'b'])
    expect(obj.a).toBe(2)
    expect(obj.b).toBe(undefined)
  })

  it('attacks', () => {
    const obj: Record<string, unknown> = {}

    setOwnProperty(obj, '__proto__', { isAdmin: true })
    expect(Object.getPrototypeOf(obj)).toBe(Object.prototype)
    expect(obj.isAdmin).toBe(undefined)
    expect(Object.keys(obj)).toEqual(['__proto__'])
    expect(JSON.stringify(obj)).toBe('{"__proto__":{"isAdmin":true}}')

    setOwnProperty(obj, '__proto__', null)
    expect(Object.getPrototypeOf(obj)).toBe(Object.prototype)
    expect(JSON.stringify(obj)).toBe('{"__proto__":null}')

    setOwnProperty(obj, 'constructor', { prototype: { isAdmin: true } })
    setOwnProperty(obj, 'prototype', { isAdmin: true })
    expect(Object.getPrototypeOf(obj)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).isAdmin).toBe(undefined)
    expect(
      Object.prototype.hasOwnProperty.call(Object.prototype, 'isAdmin'),
    ).toBe(false)

    const objNullPrototype: Record<string, unknown> = Object.create(null)
    setOwnProperty(objNullPrototype, '__proto__', { isAdmin: true })
    expect(Object.getPrototypeOf(objNullPrototype)).toBe(null)
    expect(objNullPrototype.isAdmin).toBe(undefined)
  })
})
