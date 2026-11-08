import { describe, it, expect } from 'vitest'
import {
  urlGetBoolean,
  urlGetFloat,
  urlGetInt,
  urlGetParams,
  urlGetString,
  urlParamToBoolean,
  urlParamToFloat,
  urlParamToInt,
} from './urlGet'

describe('urlGet', () => {
  it('urlGetParams', () => {
    const params = new URLSearchParams('a=1')
    expect(urlGetParams(params)).toBe(params)
    const url = new URL('https://example.test/?a=1')
    expect(urlGetParams(url)).toBe(url.searchParams)
    expect(urlGetParams('https://example.test/?a=1').get('a')).toBe('1')
  })

  it('urlParamTo', () => {
    expect(urlParamToBoolean(null)).toBe(null)
    expect(urlParamToBoolean(' TRUE ')).toBe(true)
    expect(urlParamToBoolean('1')).toBe(true)
    expect(urlParamToBoolean('no')).toBe(false)
    expect(urlParamToBoolean('x')).toBe(null)

    expect(urlParamToInt(null)).toBe(null)
    expect(urlParamToInt(' 12 ')).toBe(12)
    expect(urlParamToInt('x')).toBe(null)

    expect(urlParamToFloat(null)).toBe(null)
    expect(urlParamToFloat(' 1.5 ')).toBe(1.5)
    expect(urlParamToFloat('x')).toBe(null)
  })

  it('urlGet', () => {
    const url = 'https://example.test/?some-name=x&flag=yes&count=5&rate=0.5'
    // Names are compared without case and without non-word characters
    expect(urlGetString('SomeName', url)).toBe('x')
    expect(urlGetString('absent', url)).toBe(null)
    expect(urlGetBoolean('flag', url)).toBe(true)
    expect(urlGetInt('count', url)).toBe(5)
    expect(urlGetFloat('rate', url)).toBe(0.5)
  })
})
