import {
  Page,
  Browser,
  BrowserContext,
  BrowserContextOptions,
} from 'playwright'
import { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { Filters } from './initPage'
import type { PromiseLikeOrValue } from 'src/common/types/common'

export type TestFuncArgs = {
  browser: Browser
  context: BrowserContext
  contextOptions: BrowserContextOptions
  page: Page
  abortSignal: IAbortSignalFast
  filters?: null | Filters
}

export type TestFunc = (args: TestFuncArgs) => PromiseLikeOrValue<void>
