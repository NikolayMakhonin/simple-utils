import { Browser, BrowserContext, BrowserContextOptions } from 'playwright'
import { delayOnErrorCall } from './delayOnError'
import { setPlaywrightPriorityLow } from '../setPlaywrightPriorityLow'

export function useBrowserContext<T = void>({
  browser,
  options,
}: {
  browser: Browser
  options?: null | BrowserContextOptions
}) {
  return async function _useBrowserContext(
    func: (context: BrowserContext) => Promise<T>,
  ): Promise<T> {
    const context = await browser.newContext(options ?? undefined)
    await setPlaywrightPriorityLow()
    try {
      const result = await func(context)
      await context.close()
      return result
    } catch (err) {
      const delayPromise = delayOnErrorCall?.()
      if (delayPromise) {
        console.error('[test][useBrowserContext] error', err)
        void delayPromise.finally(() => context.close())
      } else {
        await context.close()
      }
      throw err
    }
  }
}
