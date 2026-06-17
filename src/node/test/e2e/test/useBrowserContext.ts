import { Browser, BrowserContext, BrowserContextOptions } from 'playwright'
import { contextClose, contextCloseOnError, contextCreate } from './context'
import type { PromiseLikeOrValue } from 'src/common/types/common'

/**
 * @see contextCreate
 * @see contextClose
 * @see contextCloseOnError
 */
export function useBrowserContext<T = void>({
  browser,
  options,
}: {
  browser: Browser
  options?: null | BrowserContextOptions
}) {
  return async function _useBrowserContext(
    func: (context: BrowserContext) => PromiseLikeOrValue<T>,
  ): Promise<T> {
    const context = await contextCreate(browser, options)
    try {
      const result = await func(context)
      await contextClose(context)
      return result
    } catch (err) {
      await contextCloseOnError(context)
      throw err
    }
  }
}
