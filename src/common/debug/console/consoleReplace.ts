/* eslint-disable prefer-rest-params */

import { isPromiseLike } from '@flemist/async-utils'

// TODO: write doc comment
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

// TODO: write doc comment
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

// TODO: write doc comment
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

// TODO: write doc comment
export type WithConsoleReplaceFunc = <T>(callback: () => T) => T

// TODO: write doc comment
export function withConsoleReplace(
  handler: (console: Console, level: ConsoleMessageLevel, args: any[]) => void,
): WithConsoleReplaceFunc {
  return function _withConsoleReplace<T>(callback: () => T): T {
    const restore = consoleReplace(handler)
    try {
      const result = callback()
      if (isPromiseLike(result)) {
        return result.then(
          o => {
            restore()
            return o
          },
          err => {
            restore()
            throw err
          },
        ) as any
      }
      return result
    } finally {
      restore()
    }
  }
}
