import { TestFuncArgs } from './types'
import { Filters, initPage } from './initPage'
import path from 'path'
import {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from 'playwright'
import { IAbortSignalFast } from '@flemist/abort-controller-fast'

export type TestPageFuncArgs = TestFuncArgs & {
  checkErrors: () => Promise<void>
}

export type TestPageFunc = (args: TestPageFuncArgs) => Promise<void>

export type TestPageArgs = {
  browser: Browser
  context: BrowserContext
  contextOptions: BrowserContextOptions
  page: Page
  abortSignal?: null | IAbortSignalFast
  filters?: null | Filters
  func: TestPageFunc
  /** for reporting only */
  pageFilePath?: null | string
}

export async function testPage({
  browser,
  context,
  contextOptions,
  page,
  abortSignal: _abortSignal,
  filters,
  func,
  pageFilePath,
}: TestPageArgs) {
  const browserName = browser.browserType().name()
  try {
    const { abortSignal, checkErrors } = await initPage({
      page,
      abortSignal: _abortSignal,
      filters,
      pageFilePath,
    })

    await func({
      browser,
      context,
      contextOptions,
      page,
      abortSignal,
      checkErrors,
    })

    await checkErrors()
  } catch (error: any) {
    let prefix = `Error in (${browserName}) ${page.url()}\n`
    if (pageFilePath) {
      prefix += `    at _ (${path.resolve(pageFilePath)}:0:0)\n`
    }
    error.stack = prefix + (error.stack || error.message)
    error.message = prefix + error.message
    // console.error(error)
    throw error
  }
}
