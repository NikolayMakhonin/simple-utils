import type { Browser, BrowserContext, BrowserContextOptions } from 'playwright'
import { setPlaywrightPriorityLow } from '../setPlaywrightPriorityLow'
import { delayOnErrorCall } from './delayOnError'

/**
 * Create context and set low priority for playwright processes
 * @see setPlaywrightPriorityLow
 * @see contextClose
 * @see contextCloseOnError
 *
 * Usage:
 * ```ts
 * const context = await contextCreate(browser, options)
 * try {
 *   // do something with context
 *   contextClose(context)
 * } catch (err) {
 *   await contextCloseOnError(context)
 *   throw err
 * }
 * ```
 */
export async function contextCreate(
  browser: Browser,
  options?: null | BrowserContextOptions,
) {
  const context = await browser.newContext(options ?? undefined)
  await setPlaywrightPriorityLow()
  return context
}

/**
 * Simple context close
 *
 * @see contextCreate
 * @see contextCloseOnError
 */
export async function contextClose(context: BrowserContext) {
  await context.close()
}

/**
 * Close context with delay if any error happened
 *
 * @see delayOnErrorSet
 * @see contextCreate
 * @see contextClose
 */
export async function contextCloseOnError(context: BrowserContext) {
  const delayPromise = delayOnErrorCall()
  if (delayPromise) {
    void delayPromise.finally(() => context.close())
  } else {
    await context.close()
  }
}
