import { describe, it, expect } from 'vitest'
import { consoleReplace } from './consoleReplace'

describe('consoleReplace', () => {
  it('base', () => {
    const calls: unknown[][] = []
    const restore = consoleReplace((console, level, args) => {
      calls.push([level, ...args])
    })
    try {
      console.log('a', 1)
      console.error('b')
    } finally {
      restore()
    }
    expect(calls).toEqual([
      ['log', 'a', 1],
      ['error', 'b'],
    ])
  })

  it('restore puts back the replaced functions', () => {
    const log = console.log
    const restore = consoleReplace(() => {})
    expect(console.log).not.toBe(log)
    restore()
    expect(console.log).toBe(log)
  })

  it('a nested replacement passes messages to the outer one', () => {
    const calls: unknown[] = []
    const restoreOuter = consoleReplace((console, level, args) => {
      calls.push('outer ' + args[0])
    })
    try {
      const restoreInner = consoleReplace((console, level, args) => {
        calls.push('inner ' + args[0])
        console[level](...args)
      })
      console.log('a')
      restoreInner()
      console.log('b')
    } finally {
      restoreOuter()
    }
    expect(calls).toEqual(['inner a', 'outer a', 'outer b'])
  })
})
