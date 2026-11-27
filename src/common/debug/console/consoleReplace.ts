import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'
import type { EnumOf } from 'src/common/types/common'

// TODO: write doc comments
export type ConsoleMessageLevel = EnumOf<typeof ConsoleMessageLevel>
export const ConsoleMessageLevel = {
  log: 'log',
  warn: 'warn',
  error: 'error',
  info: 'info',
  debug: 'debug',
  trace: 'trace',
  assert: 'assert',
} as const

const consoleMethods: ConsoleMessageLevel[] =
  /* @__PURE__ */ Object.values(ConsoleMessageLevel)

// TODO: write doc comments
export type Console = Record<ConsoleMessageLevel, (...args: any[]) => void>

// TODO: write doc comments
export function consoleReplace(
  handler: (console: Console, level: ConsoleMessageLevel, args: any[]) => void,
): () => void {
  const methodsPrev = {} as Console
  const consolePrev = {} as Console
  for (let i = 0, len = consoleMethods.length; i < len; i++) {
    const level = consoleMethods[i]
    const method: Console[ConsoleMessageLevel] = console[level]
    methodsPrev[level] = method
    consolePrev[level] = (...args: any[]) => method.apply(console, args)
    console[level] = (...args: any[]) => {
      handler(consolePrev, level, args)
    }
  }
  return () => {
    for (let i = 0, len = consoleMethods.length; i < len; i++) {
      const level = consoleMethods[i]
      console[level] = methodsPrev[level]
    }
  }
}

// TODO: write doc comments
export type WithConsoleReplaceFunc = <T>(
  callback: (abortSignal: IAbortSignalFast) => T,
) => T

export type WithConsoleReplaceHandler = (
  console: Console,
  level: ConsoleMessageLevel,
  args: any[],
) => void

// TODO: write doc comments
export function withConsoleReplace(
  handler: WithConsoleReplaceHandler,
): WithConsoleReplaceFunc {
  return function _withConsoleReplace<T>(
    callback: (abortSignal: IAbortSignalFast) => T,
  ): T {
    const abortController = new AbortControllerFast()

    const _handler: WithConsoleReplaceHandler = (console, level, args) => {
      try {
        handler(console, level, args)
      } catch (err) {
        if (!abortController.signal.aborted) {
          abortController.abort(err)
        }
      }
    }

    const restore = consoleReplace(_handler)

    const _restore = () => {
      restore()
      abortController.signal.throwIfAborted()
    }

    try {
      const result = callback(abortController.signal)
      if (isPromiseLike(result)) {
        return result.then(
          o => {
            _restore()
            return o
          },
          err => {
            _restore()
            throw err
          },
        ) as any
      }
      _restore()
      return result
    } catch (err) {
      _restore()
      throw err
    }
  }
}
