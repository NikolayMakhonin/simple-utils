import { describe, it } from 'vitest'
import * as assert from 'assert'
import { getCallerStackFrame } from './getCallerStackFrame'

describe('getCallerStackFrame', function () {
  function func() {
    const callerStackFrame = getCallerStackFrame()
    assert.ok(
      /^[ \t]*at caller( .*)?$/.test(callerStackFrame!),
      callerStackFrame!,
    )
  }

  function caller() {
    func()
  }

  it('base', function () {
    caller()
  })
})
