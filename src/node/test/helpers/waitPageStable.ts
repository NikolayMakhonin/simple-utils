import { Page } from 'playwright'

/** At least one of `childList`, `attributes`, or `characterData` must be `true` */
export type WaitPageStableMutationOptions = {
  /** Observe child element additions and removals */
  childList?: null | boolean
  /** Observe attribute changes */
  attributes?: null | boolean
  /** Observe text content changes */
  characterData?: null | boolean
  /** Observe all descendants, not just direct children */
  subtree?: null | boolean
  /** CSS selector of the target element. Default: document.documentElement */
  selector?: null | string
}

export type WaitPageStableResourceOptions = {
  /** Observe resource loading (scripts, images, fonts, fetch, XHR, etc) */
  resource?: null | boolean
  /** Observe navigation entries */
  navigation?: null | boolean
  /** Observe paint entries */
  paint?: null | boolean
  /** Observe long task entries */
  longTask?: null | boolean
}

export type WaitPageStableOptions = {
  /** Milliseconds of no changes before resolving */
  stableTime: number
  /** Maximum milliseconds to wait before throwing */
  timeout: number
  /** MutationObserver options */
  mutation?: null | WaitPageStableMutationOptions
  /** PerformanceObserver options */
  resource?: null | WaitPageStableResourceOptions
}

export function waitPageStable(page: Page, options: WaitPageStableOptions) {
  const stableTime = options.stableTime
  const timeout = options.timeout

  const mutation = options.mutation
    ? {
        childList: !!options.mutation.childList,
        attributes: !!options.mutation.attributes,
        characterData: !!options.mutation.characterData,
        subtree: !!options.mutation.subtree,
        selector: options.mutation.selector ?? null,
      }
    : null

  const resource = options.resource
    ? {
        resource: !!options.resource.resource,
        navigation: !!options.resource.navigation,
        paint: !!options.resource.paint,
        longTask: !!options.resource.longTask,
      }
    : null

  return page.evaluate(
    ({ stableTime, timeout, mutation, resource }) => {
      return new Promise<void>((resolve, reject) => {
        let lastChangeTime = Date.now()
        let stableTimer: ReturnType<typeof setTimeout> | null = null
        let timeoutTimer: ReturnType<typeof setTimeout> | null = null
        const unsubscribes: (() => void)[] = []

        function onChange() {
          lastChangeTime = Date.now()
        }

        function cleanup() {
          if (stableTimer != null) {
            clearTimeout(stableTimer)
            stableTimer = null
          }
          if (timeoutTimer != null) {
            clearTimeout(timeoutTimer)
            timeoutTimer = null
          }
          for (let i = 0, len = unsubscribes.length; i < len; i++) {
            unsubscribes[i]()
          }
        }

        function check() {
          const remaining = stableTime - (Date.now() - lastChangeTime)
          if (remaining <= 0) {
            cleanup()
            resolve()
          } else {
            stableTimer = setTimeout(check, remaining)
          }
        }

        if (mutation) {
          const unsubscribe = subscribeMutationObserver(mutation, onChange)
          unsubscribes.push(unsubscribe)
        }

        if (resource) {
          const unsubscribe = subscribePerformanceObserver(resource, onChange)
          unsubscribes.push(unsubscribe)
        }

        stableTimer = setTimeout(check, stableTime)

        timeoutTimer = setTimeout(() => {
          cleanup()
          reject(
            new Error(
              `[waitPageStable] timed out after ${timeout}ms waiting for page to stabilize`,
            ),
          )
        }, timeout)
      })

      function subscribeMutationObserver(
        options: {
          childList: boolean
          attributes: boolean
          characterData: boolean
          subtree: boolean
          selector: string | null
        },
        onChange: () => void,
      ): () => void {
        const target = options.selector
          ? document.querySelector(options.selector)
          : document.documentElement

        if (!target) {
          throw new Error(
            `[waitPageStable] element not found: ${options.selector}`,
          )
        }

        const observer = new MutationObserver(onChange)

        observer.observe(target, {
          childList: options.childList,
          attributes: options.attributes,
          characterData: options.characterData,
          subtree: options.subtree,
        })

        return () => {
          observer.disconnect()
        }
      }

      function subscribePerformanceObserver(
        options: {
          resource: boolean
          navigation: boolean
          paint: boolean
          longTask: boolean
        },
        onChange: () => void,
      ): () => void {
        const entryTypes: string[] = []
        if (options.resource) entryTypes.push('resource')
        if (options.navigation) entryTypes.push('navigation')
        if (options.paint) entryTypes.push('paint')
        if (options.longTask) entryTypes.push('longtask')

        const observer = new PerformanceObserver(onChange)

        observer.observe({ entryTypes })

        return () => {
          observer.disconnect()
        }
      }
    },
    { stableTime, timeout, mutation, resource },
  )
}
