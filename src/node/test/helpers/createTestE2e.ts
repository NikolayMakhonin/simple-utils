import {
  type Filters,
  testPage,
  useBrowserContext,
} from 'src/node/test/e2e/test'
import { type IPool, poolRunWait } from '@flemist/time-limits'
import { type Priority } from '@flemist/priority-queue'
import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from 'playwright'
import {
  AbortControllerFast,
  AbortError,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { combineAbortSignals } from '@flemist/async-utils'
import {
  createTestVariants,
  type TestVariantsSetArgs,
} from '@flemist/test-variants'
import { setPlaywrightPriorityLow } from 'src/node/test/e2e/setPlaywrightPriorityLow'

export type TestE2eArgs = {
  browser: Browser
  contextOptions: BrowserContextOptions
  /** just test name for logs */
  name: string
  url: string
  /** error filters */
  filters?: Filters
  pool: IPool
  priority?: Priority
}
export type TestE2eFunc<Args = never> = (
  args: TestE2eArgs & Args,
  abortSignal?: null | IAbortSignalFast,
) => Promise<void>
export type TestE2ePageArgs<Args> = {
  browser: Browser
  context: BrowserContext
  contextOptions: BrowserContextOptions
  page: Page
  url: string
  /** check http and js errors */
  checkErrors: () => Promise<void>
  abortSignal: IAbortSignalFast
  /** custom test args */
  args: Args
}
export type TestE2ePageFunc<Args = never> = (
  args: TestE2ePageArgs<Args>,
) => Promise<void>

const abortControllerGlobal = new AbortControllerFast()

let countCompleted = 0
export function createTestE2e<Args>(
  testPageFunc: TestE2ePageFunc<Args>,
): TestE2eFunc<Args> {
  return async function testE2e(
    {
      browser,
      contextOptions,
      name,
      url,
      pool,
      priority,
      filters,
      ...args
    }: TestE2eArgs & Args,
    abortSignal?: null | IAbortSignalFast,
  ) {
    const abortSignalCombined = combineAbortSignals(
      abortControllerGlobal.signal,
      abortSignal,
    )

    try {
      await poolRunWait({
        pool: pool,
        count: 1,
        priority: priority,
        abortSignal: abortSignalCombined,
        func: async (_, abortSignal) => {
          abortSignal!.throwIfAborted()

          await useBrowserContext({
            browser: browser,
            options: contextOptions,
          })(async context => {
            abortSignal!.throwIfAborted()

            const page = await context.newPage()
            await setPlaywrightPriorityLow()

            const browserName = browser.browserType().name()

            const unsubscribe = abortSignal!.subscribe(() => {
              if (!page.isClosed()) {
                page.close({
                  // reason: reason?.message,
                  runBeforeUnload: false,
                })
                context.close({
                  // reason: reason?.message,
                })
              }
            })

            try {
              console.log(`START ${name} (${browserName}): ${url}`)
              await testPage({
                browser,
                context,
                contextOptions,
                page,
                abortSignal,
                filters: filters,
                func: async ({
                  browser,
                  context,
                  contextOptions,
                  page,
                  checkErrors,
                  abortSignal,
                }) => {
                  await testPageFunc({
                    browser,
                    context,
                    contextOptions,
                    page,
                    url,
                    checkErrors,
                    abortSignal,
                    args: args as any,
                  })
                },
              })
              console.log(
                `END [${countCompleted++}] ${name} (${browserName}): ${url}`,
              )
            } catch (error: any) {
              if (abortSignal!.aborted || error instanceof AbortError) {
                console.log(`ABORTED ${name} (${browserName}): ${url}`)
                return
              }
              console.log(`ERROR ${name} (${browserName}): ${url}`)
              if (!abortControllerGlobal.signal.aborted) {
                console.log('unsubscribe on first error')
                unsubscribe()
              }
              abortControllerGlobal.abort()
              throw error
            }
          })
        },
      })
    } catch (error: any) {
      if (error instanceof AbortError) {
        return
      }
      throw error
    }
  }
}

export function createTestE2eVariants<Args = never>(
  func: TestE2ePageFunc<Args>,
): TestVariantsSetArgs<TestE2eArgs & Args> {
  const testE2e = createTestE2e(func)
  return createTestVariants<TestE2eArgs & Args>(async args => {
    return await testE2e(args)
  })
}
