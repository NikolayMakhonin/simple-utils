import { Browser, BrowserType, LaunchOptions } from 'playwright'
import type { PromiseLikeOrValue } from 'src/common/types/common'

export function useBrowser<T = void>({
  browserType,
  options,
}: {
  browserType: BrowserType
  options?: null | LaunchOptions
}) {
  return async function _useBrowser(
    func: (browser: Browser) => PromiseLikeOrValue<T>,
  ): Promise<T> {
    const browser = await browserType.launch(options ?? undefined)
    try {
      return await func(browser)
    } finally {
      await browser.close()
    }
  }
}
