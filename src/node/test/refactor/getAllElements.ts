import type { TElement, TGetAllElementsArgs, TNameValue, TStyle } from './types'

export function getAllElements(args: TGetAllElementsArgs) {
  function nameValueToObject(nameValue: [string, string][]): TNameValue {
    return nameValue
      .sort((o1, o2) => (o1[0] > o2[0] ? 1 : -1))
      .reduce((a, o) => {
        a[o[0]] = o[1]
        return a
      }, {})
  }

  function arrayToObject(keys: string[]): { [key: string]: boolean } {
    return keys.reduce((a, o) => {
      a[o] = true
      return a
    }, {})
  }

  const excludeAttrs =
    args.filters &&
    args.filters.excludeAttrs &&
    arrayToObject(args.filters.excludeAttrs)
  const fixAttrs = args.filters && args.filters.fixAttrs
  const fixStyles = args.filters && args.filters.fixStyles
  const excludeStyles =
    args.filters &&
    args.filters.excludeStyles &&
    arrayToObject(args.filters.excludeStyles)
  const fixTags = args.filters && args.filters.fixTags
  const excludeClasses = args.filters && args.filters.excludeClasses
  const excludeIds = args.filters && args.filters.excludeIds
  const excludeSelectorClasses =
    args.filters && args.filters.excludeSelectorClasses
  const excludeSelectorIds = args.filters && args.filters.excludeSelectorIds
  let excludeSelectors: Set<Element>
  if (
    args.filters &&
    args.filters.excludeSelectors &&
    args.filters.excludeSelectors.length > 0
  ) {
    const excludeElements = Array.from(
      document.querySelectorAll(args.filters.excludeSelectors.join(',')),
    )
    if (excludeElements.length > 0) {
      excludeSelectors = new Set(excludeElements)
    }
  }

  function _getStyle(
    elem: Element,
    pseudo: string | null | undefined,
    defaultStyle: TNameValue | null | undefined,
    shouldEqualStyle: TNameValue | null | undefined,
  ): TNameValue {
    const style = getComputedStyle(elem, pseudo)
    const result: [string, string][] = []
    for (let i = 0, len = style.length; i < len; i++) {
      const name = style[i]
      if (excludeStyles && excludeStyles[name]) {
        continue
      }
      let value = style[name]
      if (value && fixStyles) {
        for (let k = 0, fixLen = fixStyles.length; k < fixLen; k++) {
          if (fixStyles[k].name.test(name)) {
            value = value.replace(fixStyles[k].search, fixStyles[k].replace)
          }
        }
      }
      if (
        (!defaultStyle || defaultStyle[name] !== value) &&
        (!shouldEqualStyle || shouldEqualStyle[name] === value)
      ) {
        result.push([name, value])
      }
    }
    return nameValueToObject(result)
  }

  function getStyle(
    elem: Element,
    defaultStyle: TStyle | null | undefined,
    shouldEqualStyle: TStyle | null | undefined,
  ): TStyle {
    return {
      _: _getStyle(
        elem,
        void 0,
        defaultStyle && defaultStyle._,
        shouldEqualStyle && shouldEqualStyle._,
      ),
      before: _getStyle(
        elem,
        'before',
        defaultStyle && defaultStyle.before,
        shouldEqualStyle && shouldEqualStyle.before,
      ),
      after: _getStyle(
        elem,
        'after',
        defaultStyle && defaultStyle.after,
        shouldEqualStyle && shouldEqualStyle.after,
      ),
    }
  }

  function fillChilds(
    parent: Element,
    childs: TElement[],
    computeStyles: boolean,
    prevSelector: string,
    shouldEqualElements: TElement[] | null | undefined,
  ) {
    for (
      let i = 0, childCount = parent.childNodes.length;
      i < childCount;
      i++
    ) {
      const child = parent.childNodes[i]
      if (!child) {
        throw new Error(
          `child is null; index=${i}; ${prevSelector}, ${parent.className}\r\nYou should wait js executions before test`,
        )
      }
      if (child instanceof Element) {
        _getAllElements(
          child,
          childs,
          computeStyles,
          prevSelector,
          shouldEqualElements,
        )
      }
    }
  }

  function _getAllElements(
    parent: Element,
    output: TElement[],
    computeStyles: boolean,
    prevSelector: string,
    shouldEqualElements: TElement[] | null | undefined,
  ) {
    const prevElement =
      shouldEqualElements && shouldEqualElements[output.length]

    if (shouldEqualElements && !prevElement) {
      return
    }

    if (excludeSelectors && excludeSelectors.has(parent)) {
      return
    }

    let tag = parent.tagName && parent.tagName.toLowerCase()
    if (tag === 'head') {
      computeStyles = false
    }

    if (fixTags) {
      for (let i = 0, fixLen = fixTags.length; i < fixLen; i++) {
        tag = tag.replace(fixTags[i].search, fixTags[i].replace)
      }
    }

    if (prevElement && prevElement.tag !== tag) {
      return
    }

    const attrs: [string, string][] = []
    for (let j = 0, len = parent.attributes.length; j < len; j++) {
      const attr = parent.attributes.item(j)!
      let name = attr.name
      let value = attr.value
      name = name.toLowerCase()
      if (name === 'class') {
        continue
      }
      if (excludeAttrs && excludeAttrs[name]) {
        continue
      }
      if (fixAttrs) {
        for (let k = 0, fixLen = fixAttrs.length; k < fixLen; k++) {
          if (fixAttrs[k].name.test(name)) {
            value = value.replace(fixAttrs[k].search, fixAttrs[k].replace)
          }
        }
      }
      if (
        !prevElement ||
        (prevElement.attrs && prevElement.attrs[name] === value)
      ) {
        attrs.push([name, value])
      }
    }
    const classes: string[] = []
    const selectorClasses: string[] = []
    for (let j = 0, len = parent.classList.length; j < len; j++) {
      const _class = parent.classList.item(j)!
      if (!excludeClasses || !excludeClasses.test(_class)) {
        classes.push(_class)
      }
      if (!excludeSelectorClasses || !excludeSelectorClasses.test(_class)) {
        selectorClasses.push(_class)
      }
    }
    const style = computeStyles
      ? getStyle(parent, args.defaultStyle, prevElement && prevElement.style)
      : null
    const childs = parent.childElementCount ? [] : null
    const id =
      parent.id && (!excludeIds || !excludeIds.test(parent.id)) ? parent.id : ''
    const selectorId =
      parent.id && (!excludeSelectorIds || !excludeSelectorIds.test(parent.id))
        ? parent.id
        : ''
    const currentSelector =
      (tag || '') +
      (selectorId ? '#' + selectorId : '') +
      (selectorClasses.length > 0 ? '.' + selectorClasses.join('.') : '')
    const selector = !currentSelector
      ? prevSelector
      : !prevSelector
        ? currentSelector
        : prevSelector + ' > ' + currentSelector
    const element: TElement = {
      tag,
      selector,
      classes,
      attrs: attrs.length > 0 ? nameValueToObject(attrs) : null,
      style,
      childs,
    }

    output.push(element)

    if (childs) {
      fillChilds(
        parent,
        childs,
        computeStyles,
        selector,
        prevElement && prevElement.childs,
      )
    }
  }

  const result = []
  _getAllElements(
    document.documentElement,
    result,
    true,
    '',
    args.shouldEqualResult && [args.shouldEqualResult],
  )

  return result[0]
}
