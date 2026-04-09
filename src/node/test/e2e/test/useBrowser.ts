import { Browser, BrowserType, LaunchOptions } from 'playwright'

export function useBrowser<T = void>({
  browserType,
  options,
}: {
  browserType: BrowserType
  options?: null | LaunchOptions
}) {
  return async function _useBrowser(
    func: (browser: Browser) => Promise<T>,
  ): Promise<T> {
    const browser = await browserType.launch(options ?? undefined)
    try {
      return await func(browser)
    } finally {
      await browser.close()
    }
  }
}
