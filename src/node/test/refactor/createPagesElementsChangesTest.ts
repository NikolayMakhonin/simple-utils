import { type CDPSession, Page } from 'playwright'
import { delay } from '@flemist/async-utils'
import { loadJson, saveJson } from './loadSaveJson'
import { DIFF_NEW, DIFF_OLD, getObjectsDiff } from './getObjectsDiff'
import * as fs from 'fs'
import { getAllElements } from './getAllElements'
import {
  createCDPSession,
  destroyCDPSession,
  forcePseudoClasses,
} from './forcePseudoClasses'
import { getElementsStyleDiff } from './getElementsStyleDiff'
import type {
  PagesElementsChangesTest,
  TPseudoStateConfig,
  TElement,
  TGetAllElementsFilters,
} from './types'
import { getNormalizedObject } from 'src/common/object/getNormalizedObject'

export type ObjectTransform = (
  value: any,
  keyOrIndex: string | number | null | undefined,
  parent: any | null | undefined,
  transform: ObjectTransform,
) => any

export const objectTransform: ObjectTransform = (
  obj,
  keyOrIndex,
  parent,
  transform,
) => {
  const result = transform(obj, keyOrIndex, parent, transform)
  if (result == null) {
    return result
  }
  if (Array.isArray(result)) {
    return result.map((item, index, parent) =>
      objectTransform(item, index, parent, transform),
    )
  }
  if (typeof result === 'object') {
    const newObj = {} as any
    for (const key in result) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        newObj[key] = objectTransform(result[key], key, result, transform)
      }
    }
    return newObj
  }
  return result
}

function applyExcludeFiltersToElement(
  element: TElement,
  filters: TGetAllElementsFilters,
) {
  if (element.attrs && filters.excludeAttrs) {
    for (let i = 0, len = filters.excludeAttrs.length; i < len; i++) {
      delete element.attrs[filters.excludeAttrs[i]]
    }
    if (Object.keys(element.attrs).length === 0) {
      element.attrs = null
    }
  }
  if (element.classes && filters.excludeClasses) {
    element.classes = element.classes.filter(
      o => !filters.excludeClasses!.test(o),
    )
  }
  if (element.style && filters.excludeStyles) {
    for (const pseudo of ['_', 'before', 'after'] as const) {
      const styleObj = element.style[pseudo]
      if (styleObj) {
        for (let i = 0, len = filters.excludeStyles.length; i < len; i++) {
          delete styleObj[filters.excludeStyles[i]]
        }
      }
    }
  }
  if (element.childs) {
    for (let i = 0, len = element.childs.length; i < len; i++) {
      applyExcludeFiltersToElement(element.childs[i], filters)
    }
  }
}

function applyExcludeFiltersToPages(
  pages: any,
  filters: TGetAllElementsFilters,
) {
  for (const testId in pages) {
    if (!Object.prototype.hasOwnProperty.call(pages, testId)) continue
    const urls = pages[testId]
    for (const url in urls) {
      if (!Object.prototype.hasOwnProperty.call(urls, url)) continue
      const states = urls[url]
      for (const stateId in states) {
        if (!Object.prototype.hasOwnProperty.call(states, stateId)) continue
        applyExcludeFiltersToElement(states[stateId], filters)
      }
    }
  }
}

export function createPagesElementsChangesTest({
  actualResultFile,
  expectedResultFile,
  diffResultFile,
  filters,
  transform,
  pseudoStates,
}: {
  actualResultFile: string
  expectedResultFile: string
  diffResultFile?: string
  filters?: TGetAllElementsFilters
  transform?: null | ObjectTransform
  pseudoStates?: null | TPseudoStateConfig[]
}): PagesElementsChangesTest {
  let prevPages: any
  let defaultElement: TElement
  let defaultStyle: TElement['style']

  let pages: {
    [testId: string]: {
      [url: string]: {
        [stateId: string]: TElement
      }
    }
  } = {}

  return {
    async init(page: Page) {
      prevPages = await loadJson(expectedResultFile)
      if (transform) {
        prevPages = objectTransform(prevPages, null, null, transform)
      }
      if (prevPages && filters) {
        applyExcludeFiltersToPages(prevPages, filters)
      }
      await page.goto('about:blank')
      defaultElement = await page.evaluate(getAllElements, { filters })
      defaultStyle = defaultElement.style
    },
    async handlePage({
      page,
      testId,
      url,
      stateId,
      _filters,
    }: {
      page: Page
      testId: string
      url: URL
      stateId: string
      _filters?: TGetAllElementsFilters
    }) {
      let tests = pages[testId]
      if (!tests) {
        tests = {}
        pages[testId] = tests
      }
      let _pages = tests[url.href]
      if (!_pages) {
        _pages = {}
        tests[url.href] = _pages
      }

      await page.addStyleTag({
        content:
          '*, *::before, *::after { animation-name: none!important; transition-duration: 0s !important; }',
      })

      const _pseudoStates = pseudoStates ?? [{ states: [] as string[] }]
      let cdp: CDPSession | null = null
      let baseElement: TElement | undefined

      try {
        for (let i = 0; i < _pseudoStates.length; i++) {
          const pseudoState = _pseudoStates[i]
          const pseudoStateId =
            pseudoState.states.length > 0
              ? stateId + ':' + pseudoState.states.join(':')
              : stateId

          let forcePseudoClassesTime: number | null = null
          if (pseudoState.states.length > 0) {
            if (!cdp) {
              cdp = await createCDPSession(page)
            }
            const timeStart = performance.now()
            await forcePseudoClasses(cdp, pseudoState.states)
            forcePseudoClassesTime = performance.now() - timeStart
          }

          if (pseudoState.delay) {
            await delay(pseudoState.delay)
          }

          const timeStart = performance.now()
          const stateElement = await page.evaluate(getAllElements, {
            filters: _filters || filters,
            defaultStyle,
            shouldEqualResult: _pages[pseudoStateId],
          })
          const getAllElementsTime = performance.now() - timeStart

          console.log(
            `SNAPSHOT ${pseudoStateId}:` +
              (forcePseudoClassesTime != null
                ? ` forcePseudoClasses ${forcePseudoClassesTime.toFixed(0)}ms,`
                : '') +
              ` getAllElements ${getAllElementsTime.toFixed(0)}ms`,
          )

          if (!baseElement) {
            baseElement = stateElement
            _pages[pseudoStateId] = stateElement
          } else {
            const diff = getElementsStyleDiff(baseElement, stateElement)
            if (diff) {
              _pages[pseudoStateId] = diff
            }
          }
        }
      } finally {
        if (cdp) {
          await destroyCDPSession(cdp)
        }
      }
    },
    async end({ checkExistUrlsOnly }: { checkExistUrlsOnly: boolean }) {
      pages = getNormalizedObject(pages)

      if (transform) {
        pages = objectTransform(pages, null, null, transform)
      }

      if (prevPages) {
        let _prevPages
        let _pages
        if (!checkExistUrlsOnly) {
          _prevPages = prevPages
          _pages = pages
        } else {
          _prevPages = {}
          _pages = {}
          for (const id in prevPages) {
            if (
              Object.prototype.hasOwnProperty.call(prevPages, id) &&
              Object.prototype.hasOwnProperty.call(pages, id)
            ) {
              _prevPages[id] = {}
              _pages[id] = {}
              for (const url in prevPages[id]) {
                if (
                  Object.prototype.hasOwnProperty.call(prevPages[id], url) &&
                  Object.prototype.hasOwnProperty.call(pages[id], url)
                ) {
                  _prevPages[id][url] = prevPages[id][url]
                  _pages[id][url] = pages[id][url]
                }
              }
            }
          }
        }

        const diff = getObjectsDiff(
          _prevPages,
          _pages,
          (valueOld, valueNew, diffs) => {
            // selector is not comparable data; remove it from diffs
            // to prevent false positives from selector string changes
            if (diffs.selector) {
              delete diffs.selector
              if (Object.keys(diffs).length === 0) {
                return null
              }
            }
            if (diffs.childs && diffs.childs.length === 1) {
              return diffs.childs[0]
            }
            // inject selector for element identification in diff output;
            // use new (current page) selector so the element can be found in DevTools
            if (valueNew && valueNew.selector) {
              if (diffs[DIFF_NEW]) {
                diffs[DIFF_NEW] = valueNew.selector
              } else {
                diffs = { selector: valueNew.selector, ...diffs }
              }
            } else if (valueOld && valueOld.selector) {
              if (diffs[DIFF_OLD]) {
                diffs[DIFF_OLD] = valueOld.selector
              } else {
                diffs = { selector: valueOld.selector, ...diffs }
              }
            }
            return diffs
          },
        )
        if (diffResultFile) {
          await saveJson(diffResultFile, diff || {})
        }
        if (diff) {
          await saveJson(actualResultFile, pages)
          console.error(
            'Pages elements changes: ' +
              JSON.stringify(diff, null, 4).substring(0, 5000),
          )
          throw new Error('Pages elements changes detected')
        } else {
          if (await fs.promises.stat(actualResultFile).catch(() => null)) {
            await fs.promises.unlink(actualResultFile)
          }
        }
      } else {
        await saveJson(expectedResultFile, pages)
      }

      return pages
    },
  }
}
