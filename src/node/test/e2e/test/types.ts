import {
  Page,
  Browser,
  BrowserContext,
  BrowserContextOptions,
} from 'playwright'
import { IAbortSignalFast } from '@flemist/abort-controller-fast'

export type TestFuncArgs = {
  browser: Browser
  context: BrowserContext
  contextOptions: BrowserContextOptions
  page: Page
  abortSignal: IAbortSignalFast
}

export type TestFunc = (args: TestFuncArgs) => Promise<void>
