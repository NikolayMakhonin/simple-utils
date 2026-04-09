import {
  checkPageHttpErrors,
  type RegExpRule,
  type UrlWithError,
} from '../check/checkPageHttpErrors'
import { subscribeJsErrors } from '../check/subscribeJsErrors'
import { Page } from 'playwright'
import {
  AbortControllerFast,
  IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { combineAbortSignals } from '@flemist/async-utils'
import path from 'path'

export type Filters = {
  js?: {
    filter?: null | ((args: { url: URL; error: string }) => boolean)
  } | null
  http?: {
    urlFilters?: RegExpRule[] | null
    errorFilter?: ((args: UrlWithError) => boolean) | null
  } | null
}

export async function initPage(args: {
  page: Page
  /** for reporting only */
  pageFilePath?: null | string
  abortSignal?: null | IAbortSignalFast
  filters?: null | Filters
}) {
  const { page } = args
  const browserName = page.context().browser()?.browserType().name()
  const abortController = new AbortControllerFast()
  const abortSignal = combineAbortSignals(
    abortController.signal,
    args.abortSignal,
  )
  const onError = (error: Error) => {
    let prefix = `Error in (${browserName}) ${page.url()}\n`
    if (args.pageFilePath) {
      prefix += `    at _ (${path.resolve(args.pageFilePath)}:0:0)\n`
    }
    error.stack = prefix + (error.stack || error.message)
    error.message = prefix + error.message
    console.error('[test][initPage] error', error)
    abortController.abort(error)
  }
  await subscribeJsErrors({
    page,
    filter: args.filters?.js?.filter,
    onError,
  })
  const checkErrors = async () => {
    await checkPageHttpErrors({
      page,
      urlFilters: args.filters?.http?.urlFilters,
      errorFilter: args.filters?.http?.errorFilter,
    })
    abortSignal.throwIfAborted()
  }

  return {
    abortSignal,
    checkErrors,
  }
}
