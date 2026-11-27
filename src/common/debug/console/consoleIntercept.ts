import {
  formatAny,
  type FormatAnyOptions,
} from 'src/common/string/format/formatAny'
import { ConsoleMessageLevel, consoleReplace } from './consoleReplace'
import { Subject } from 'src/common/rx/Subject'
import type { Emit, IObservable } from 'src/common/rx/types'
import { formatDateFileName } from 'src/common/string/format/formatDateFileName'
import { EMPTY_FUNC } from 'src/common/constants'
import { clockDateReal } from 'src/common/time/clock-date'

function formatObject(obj: any, options?: null | FormatAnyOptions): string {
  return formatAny(obj, {
    maxDepth: 5,
    maxItems: 10,
    ...options,
  })
}

function consoleArgsToString(args: any[]): string[] {
  const result: string[] = []
  for (let i = 0, len = args.length; i < len; i++) {
    result.push(formatObject(args[i]))
  }
  return result
}

export type ConsoleMessage = {
  date: number
  level: ConsoleMessageLevel
  args: string[]
}

export function consoleMessageToString(message: ConsoleMessage): string {
  return `${formatDateFileName(new Date(message.date))} [${message.level.toUpperCase()}] ${message.args.join(' ')}`
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
    if (level === 'assert' && args[0]) {
      return
    }
    if (
      level === ConsoleMessageLevel.error ||
      level === ConsoleMessageLevel.warn ||
      level === ConsoleMessageLevel.assert
    ) {
      if (consoleMessagesEmit) {
        consoleMessagesEmit({
          date: clockDateReal.value(),
          level,
          args: consoleArgsToString(args),
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
