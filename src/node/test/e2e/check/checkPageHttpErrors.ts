import { Page } from 'playwright'
import { withTimeout } from 'src/common/async/abort/timeout'

export type RegExpRule = { value: boolean; pattern: RegExp }

export type UrlWithError = {
  url: URL
  error: string
}

export type GetPageHttpErrorsTimeouts = {
  downloadInternal?: null | number
  downloadExternal?: null | number
  total?: null | number
}

export type GetPageHttpErrorsArgs = {
  page: Page
  urlFilters?: RegExpRule[] | null
  timeouts?: null | GetPageHttpErrorsTimeouts
}

export async function getPageHttpErrors({
  page,
  urlFilters,
  timeouts,
}: GetPageHttpErrorsArgs): Promise<UrlWithError[] | undefined | null> {
  if (!timeouts) {
    timeouts = {}
  }
  if (!timeouts.downloadInternal) {
    timeouts.downloadInternal = 10 * 1000
  }
  if (!timeouts.downloadExternal) {
    timeouts.downloadExternal = 60 * 1000
  }
  if (!timeouts.total) {
    timeouts.total = 5 * 60 * 1000
  }

  const pageErrors = await withTimeout(
    () =>
      page.evaluate(
        ({
          urlFilters,
          timeouts,
        }: {
          urlFilters?: RegExpRule[] | null
          timeouts: GetPageHttpErrorsTimeouts | null
        }) => {
          function createRegExpFilter(rules: RegExpRule[]) {
            return function regExpFilter(value: string) {
              let result = false
              for (let i = 0, len = rules.length; i < len; i++) {
                const rule = rules[i]
                if (rule.pattern.test(value)) {
                  result = rule.value
                }
              }
              return result
            }
          }

          const regExpFilter = urlFilters && createRegExpFilter(urlFilters)

          let resources = performance.getEntries && performance.getEntries()
          if (!resources) {
            resources = []
          }

          resources.push({
            name: location.href,
          } as any)

          return Promise.all(
            resources.map(
              (
                resource,
              ): Promise<{ url: string; error: string } | null> | null => {
                if (
                  resource.entryType != null &&
                  resource.entryType !== 'resource'
                ) {
                  return null
                }
                if (regExpFilter && !regExpFilter(resource.name)) {
                  return null
                }
                if ((resource as any).responseStatus != null) {
                  if ((resource as any).responseStatus >= 400) {
                    return Promise.resolve({
                      url: resource.name,
                      error: (resource as any).responseStatus,
                    })
                  }
                  return null
                }

                // if the browser is not chrome - return null
                if (navigator.userAgent.indexOf('Chrome') === -1) {
                  return null
                }

                const abortController =
                  typeof AbortController !== 'undefined'
                    ? new AbortController()
                    : null

                const isSameOrigin =
                  new URL(resource.name).origin === location.origin

                const timeOut = isSameOrigin
                  ? timeouts!.downloadInternal
                  : timeouts!.downloadExternal

                let abortPromiseReject: (err: Error) => void
                const abortPromise = new Promise<never>((_, reject) => {
                  abortPromiseReject = reject
                })
                const abortTimer: any =
                  timeOut &&
                  setTimeout(() => {
                    abortController?.abort()
                    abortPromiseReject(
                      new Error(`[test][getPageHttpErrors] fetch timeout`),
                    )
                  }, timeOut)

                let resultPromise = fetch(resource.name, {
                  mode: isSameOrigin ? 'same-origin' : 'no-cors',
                  signal: abortController?.signal as any,
                  cache: isSameOrigin ? 'force-cache' : void 0,
                  method: 'HEAD',
                })
                  .then(response => {
                    if (!response.ok) {
                      return {
                        url: resource.name,
                        error: response.status + ' ' + response.statusText,
                      }
                    }
                    return null
                  })
                  .catch(err => {
                    return {
                      url: resource.name,
                      error: err.message,
                    }
                  })

                if (!abortController) {
                  resultPromise = Promise.race([resultPromise, abortPromise])
                }

                function finallyFunc() {
                  if (abortTimer) {
                    clearTimeout(abortTimer)
                  }
                }

                return resultPromise.then(
                  result => {
                    finallyFunc()
                    return result
                  },
                  (err): any => {
                    finallyFunc()
                    throw err
                  },
                )
              },
            ),
          ).then(errors => {
            const _errors = errors
              .filter(o => o)
              .map(
                o =>
                  ({
                    url: new URL(o!.url),
                    error: o!.error,
                  }) as UrlWithError,
              )
            return _errors.length > 0 ? _errors : null
          })
        },
        {
          urlFilters,
          timeouts: timeouts!,
        },
      ),
    { timeout: timeouts.total },
  )

  return pageErrors
}

export async function checkPageHttpErrors({
  page,
  urlFilters,
  errorFilter,
}: {
  page: Page
  urlFilters?: RegExpRule[] | null
  errorFilter?: ((args: UrlWithError) => boolean) | null
}) {
  let pageErrors = await getPageHttpErrors({
    page,
    urlFilters,
  })
  if (pageErrors) {
    if (errorFilter) {
      pageErrors = pageErrors.filter(errorFilter)
    }
    if (pageErrors.length > 0) {
      throw new Error(
        `[test][checkPageHttpErrors] Page has http errors: ${JSON.stringify(pageErrors, null, 2)}`,
      )
    }
  }
}
