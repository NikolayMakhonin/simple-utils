import { describe, it, expect } from 'vitest'
import { getStackTrace } from './getStackTrace'

describe('getStackTrace', () => {
  it('base', () => {
    // Not a tail call: Safari drops the frame of a function that returns the result of a call
    function callerOfGetStackTrace() {
      const stack = getStackTrace()
      return stack
    }
    const stack = callerOfGetStackTrace()
    expect(stack.split('\n')[0]).toContain('callerOfGetStackTrace')
  })
})
