/* eslint-disable prefer-rest-params */

import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'

// TODO: write doc comments
export enum ConsoleMessageLevel {
  log = 'log',
  warn = 'warn',
  error = 'error',
  info = 'info',
  debug = 'debug',
  trace = 'trace',
  assert = 'assert',
}

const consoleMethods: ConsoleMessageLevel[] = Object.values(ConsoleMessageLevel)

function bindConsoleMethod(method: (...args: any[]) => void) {
  return function () {
    // @ts-ignore
    method.apply(console, arguments)
  }
}

// TODO: write doc comments
export type Console = Record<ConsoleMessageLevel, (...args: any[]) => void>

const consoleOrig: Console = {
  log: bindConsoleMethod(console.log),
  warn: bindConsoleMethod(console.warn),
  error: bindConsoleMethod(console.error),
  info: bindConsoleMethod(console.info),
  debug: bindConsoleMethod(console.debug),
  trace: bindConsoleMethod(console.trace),
  assert: bindConsoleMethod(console.assert),
}

// TODO: write doc comments
export function consoleReplace(
  handler: (console: Console, level: ConsoleMessageLevel, args: any[]) => void,
): () => void {
  consoleMethods.forEach(level => {
    console[level] = (...args: any[]) => {
      handler(consoleOrig, level, args)
    }
  })
  return () => {
    consoleMethods.forEach(level => {
      console[level] = consoleOrig[level]
    })
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
