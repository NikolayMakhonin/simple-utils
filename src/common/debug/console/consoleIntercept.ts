import {
  formatAny,
  type FormatAnyOptions,
} from 'src/common/string/format/formatAny'
import { ConsoleMessageLevel, consoleReplace } from './consoleReplace'
import { type Emit, Subject } from 'src/common/rx/Subject'
import type { IObservable } from 'src/common/rx/types'
import { formatDateFileName } from 'src/common/string/format/formatDateFileName'
import { EMPTY_FUNC } from '@flemist/async-utils'

function formatObject(obj: any, options?: null | FormatAnyOptions): string {
  return formatAny(obj, {
    maxDepth: 5,
    maxItems: 10,
    ...options,
  })
}

function consoleArgsToString(args: any[]): string[] {
  return args.map(arg =>
    arg && typeof arg === 'object' ? formatObject(arg) : arg,
  )
}

export type ConsoleMessage = {
  date: number
  level: ConsoleMessageLevel
  args: string[]
}

export function consoleMessageToString(message: ConsoleMessage): string {
  return `${formatDateFileName(new Date())} [${message.level.toUpperCase()}] ${consoleArgsToString(
    message.args,
  ).join(' ')}`
}

let consoleMessagesEmit: Emit<ConsoleMessage> | null = null
let _consoleMessages: IObservable<ConsoleMessage> | null = null
export function getConsoleMessages(): IObservable<ConsoleMessage> {
  if (!_consoleMessages) {
    _consoleMessages = new Subject({
      startStopNotifier: emit => {
        consoleMessagesEmit = emit
        return () => {
          consoleMessagesEmit = null
        }
      },
    })
  }
  return _consoleMessages
}

export function consoleIntercept() {
  return consoleReplace((console, level, args) => {
    if (level === 'assert' && args[0] === true) {
      return
    }
    if (
      level === ConsoleMessageLevel.error ||
      level === ConsoleMessageLevel.warn ||
      level === ConsoleMessageLevel.assert
    ) {
      if (consoleMessagesEmit) {
        consoleMessagesEmit({
          date: Date.now(),
          level,
          args,
        })
      }
      console[level](...args)
    }
  })
}

export function alertConsole(args: {
  levels?: null | ConsoleMessageLevel[]
  predicate?:
    | null
    | ((args: { text: string; message: ConsoleMessage }) => boolean)
}) {
  if (typeof window === 'undefined') {
    return EMPTY_FUNC
  }
  const { levels, predicate } = args
  return getConsoleMessages().subscribe(message => {
    if (levels && !levels.includes(message.level)) {
      return
    }
    const text = message.args.join('\n')
    if (predicate && !predicate({ text, message })) {
      return
    }
    alert(text)
  })
}
