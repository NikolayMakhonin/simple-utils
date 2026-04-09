import { Page } from 'playwright'
import { IAbortSignalFast } from '@flemist/abort-controller-fast'

export type TestFuncArgs = {
  page: Page
  abortSignal: IAbortSignalFast
}

export type TestFunc = (args: TestFuncArgs) => Promise<void>
