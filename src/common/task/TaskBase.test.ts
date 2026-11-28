import { describe, it, expect, vi, afterEach } from 'vitest'
import { AbortError } from '@flemist/abort-controller-fast'
import { LogLevel } from 'src/common/debug'
import { createTask } from './TaskBase'

describe('TaskBase', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs an error of the function by the console method of its level', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    const error = new Error('func error')
    const taskError = createTask(() => {
      throw error
    }, null)
    await expect(taskError.run()).rejects.toBe(error)

    const warning = new Error('func warning')
    const taskWarning = createTask(
      () => {
        throw warning
      },
      null,
      { logFuncError: () => LogLevel.warn },
    )
    await expect(taskWarning.run()).rejects.toBe(warning)

    // An abort gets the level debug by default
    const abortError = new AbortError('func aborted')
    const taskAborted = createTask(() => {
      throw abortError
    }, null)
    await expect(taskAborted.run()).rejects.toBe(abortError)

    expect(consoleError.mock.calls).toEqual([
      ['[TaskBase] the task function failed', error],
    ])
    expect(consoleWarn.mock.calls).toEqual([
      ['[TaskBase] the task function failed', warning],
    ])
    expect(consoleLog.mock.calls).toEqual([
      ['[TaskBase] the task function failed', abortError],
    ])
  })
})
