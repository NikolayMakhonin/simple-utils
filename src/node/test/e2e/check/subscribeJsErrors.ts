import type { Page } from 'playwright'
import type { OnError } from './types'
import { getStackTrace } from 'src/common/debug/stack-trace/getStackTrace'

export async function subscribeJsErrors({
  page,
  filter,
  onError,
}: {
  page: Page
  filter?: ((args: { url: URL; error: string }) => boolean) | null
  onError: OnError
}) {
  const callbackName = 'callback_191b355ea6f64499a6607ad571da5d4d'
  const browserName = page.context().browser()?.browserType().name()

  const stack = getStackTrace()

  function _onError(error: string) {
    try {
      if (
        filter &&
        !filter({
          url: new URL(page.url()),
          error,
        })
      ) {
        return
      }
    } catch (err) {
      error = String(err)
    }

    try {
      console.error(
        `[test][subscribeJsErrors] BROWSER JS ERROR (${browserName}): ${error}`,
      )
      const _error = new Error(error)
      _error.stack = stack
      onError(_error)
    } catch (err) {
      console.error('[test][subscribeJsErrors] error', err)
    }
  }

  await page.exposeFunction(callbackName, _onError)

  await page.addInitScript(callbackName => {
    function errorToString(err: any): string {
      if (Array.isArray(err)) {
        return err.map(errorToString).join('\r\n\r\n')
      }
      if (err instanceof Error) {
        return err.stack || err.toString()
      }
      if (typeof err === 'object' && err != null) {
        const objects = new Set<any>()
        return JSON.stringify(
          err,
          (key, value) => {
            if (typeof value === 'object' && value != null) {
              if (objects.has(value)) {
                return '[Circular]'
              }
              objects.add(value)
            }
            return value
          },
          2,
        )
      }
      return String(err)
    }

    function onError(error: string) {
      ;(window as any)[callbackName](error)
    }

    // intercept console
    const consoleOrig = {
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    }
    console.warn = function warn(...args: any[]) {
      onError('console.warn: ' + errorToString(args))
      return consoleOrig.warn.apply(this, args)
    }
    console.error = function error(...args: any[]) {
      onError('console.error: ' + errorToString(args))
      return consoleOrig.error.apply(this, args)
    }

    // intercept unhandled errors
    window.addEventListener(
      'error',
      function (event) {
        onError('window error: ' + (event.message || JSON.stringify(event)))
      },
      true,
    )
    window.addEventListener(
      'unhandledrejection',
      function (event) {
        onError('window unhandledrejection: ' + errorToString(event.reason))
      },
      true,
    )
  }, callbackName)

  // page.on('console', async (msg) => {
  //   const type = msg.type()
  //   if (type === 'error' || type === 'warning') {
  //     const args = msg.args()
  //     const argsStr = await Promise.all(args.map((arg) => arg.jsonValue()))
  //     const text = argsStr.join(' ')
  //     _onError(`console.${type}: ${text}\r\n${msg.location()}`)
  //   }
  // })
}
