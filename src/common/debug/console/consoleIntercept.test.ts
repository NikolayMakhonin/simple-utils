import { describe, it, expect } from 'vitest'
import {
  consoleIntercept,
  getConsoleMessages,
  type ConsoleMessage,
} from './consoleIntercept'
import { consoleReplace } from './consoleReplace'

describe('consoleIntercept', () => {
  // consoleIntercept prints errors and warnings to the console that it replaces.
  // The empty replacement under it keeps them out of the output of the tests
  function getMessages(func: () => void): string[][] {
    const messages: ConsoleMessage[] = []
    const unsubscribe = getConsoleMessages().subscribe(message => {
      messages.push(message)
    })
    const restoreSilent = consoleReplace(() => {})
    const restoreIntercept = consoleIntercept()
    try {
      func()
    } finally {
      restoreIntercept()
      restoreSilent()
      unsubscribe()
    }
    return messages.map(o => [o.level, ...o.args])
  }

  it('base', () => {
    expect(getMessages(() => {})).toEqual([])
    expect(getMessages(() => console.log('a'))).toEqual([])
    expect(getMessages(() => console.warn('b'))).toEqual([['warn', 'b']])
    expect(getMessages(() => console.error('c'))).toEqual([['error', 'c']])
  })

  it('arguments are formatted as strings', () => {
    expect(
      getMessages(() => console.warn('a', null, undefined, 1, { b: 2 })),
    ).toEqual([['warn', 'a', 'null', 'undefined', '1', '{b: 2}']])
  })

  it('assert with a truthy condition emits nothing', () => {
    expect(
      getMessages(() => {
        console.assert(true, 'passed')
        console.assert(1 as any, 'passed')
      }),
    ).toEqual([])
    expect(getMessages(() => console.assert(false, 'failed'))).toEqual([
      ['assert', 'false', 'failed'],
    ])
  })
})
