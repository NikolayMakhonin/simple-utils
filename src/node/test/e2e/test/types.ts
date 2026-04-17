import {
  Page,
  Browser,
  BrowserContext,
  BrowserContextOptions,
} from 'playwright'
import { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { Filters } from './initPage'

export type TestFuncArgs = {
  browser: Browser
  context: BrowserContext
  contextOptions: BrowserContextOptions
  page: Page
  abortSignal: IAbortSignalFast
  filters?: null | Filters
}

export type TestFunc = (args: TestFuncArgs) => Promise<void>
