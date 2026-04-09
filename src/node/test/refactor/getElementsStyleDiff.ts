import type { TElement, TNameValue, TStyle } from './types'

function getNameValueDiff(
  base: TNameValue,
  state: TNameValue,
): TNameValue | null
function getNameValueDiff(
  base: TNameValue | null | undefined,
  state: TNameValue | null | undefined,
): TNameValue | null
function getNameValueDiff(
  base: TNameValue | null | undefined,
  state: TNameValue | null | undefined,
): TNameValue | null {
  if (!base || !state) {
    return state || null
  }
  let diff: TNameValue | null = null
  for (const key in state) {
    if (Object.prototype.hasOwnProperty.call(state, key)) {
      if (state[key] !== base[key]) {
        if (!diff) {
          diff = {}
        }
        diff[key] = state[key]
      }
    }
  }
  for (const key in base) {
    if (
      Object.prototype.hasOwnProperty.call(base, key) &&
      !Object.prototype.hasOwnProperty.call(state, key)
    ) {
      if (!diff) {
        diff = {}
      }
      diff[key] = ''
    }
  }
  return diff
}

function getStyleDiff(
  base: TStyle | null | undefined,
  state: TStyle | null | undefined,
): TStyle | null {
  if (!base || !state) {
    return state || null
  }
  const _ = getNameValueDiff(base._, state._)
  const before = getNameValueDiff(base.before, state.before)
  const after = getNameValueDiff(base.after, state.after)
  if (!_ && !before && !after) {
    return null
  }
  return {
    _: _ || {},
    before: before || {},
    after: after || {},
  }
}

function getArrayDiff<T>(base: T[], state: T[]): T[] | null
function getArrayDiff<T>(
  base: T[] | null | undefined,
  state: T[] | null | undefined,
): T[] | null
function getArrayDiff<T>(
  base: T[] | null | undefined,
  state: T[] | null | undefined,
): T[] | null {
  if (!base || !state) {
    return state || null
  }
  if (base.length !== state.length) {
    return state
  }
  for (let i = 0, len = base.length; i < len; i++) {
    if (base[i] !== state[i]) {
      return state
    }
  }
  return null
}

export function getElementsStyleDiff(
  base: TElement,
  state: TElement,
): TElement | null {
  const classesDiff = getArrayDiff(base.classes, state.classes)
  const attrsDiff = getNameValueDiff(base.attrs, state.attrs)
  const styleDiff = getStyleDiff(base.style, state.style)

  let diffChilds: TElement[] | null = null
  if (base.childs && state.childs) {
    const len = Math.min(base.childs.length, state.childs.length)
    for (let i = 0; i < len; i++) {
      const childDiff = getElementsStyleDiff(base.childs[i], state.childs[i])
      if (childDiff) {
        if (!diffChilds) {
          diffChilds = []
          for (let j = 0; j < len; j++) {
            diffChilds.push({} as TElement)
          }
        }
        diffChilds[i] = childDiff
      }
    }
  }

  if (!classesDiff && !attrsDiff && !styleDiff && !diffChilds) {
    return null
  }

  return {
    tag: state.tag,
    selector: state.selector,
    classes: classesDiff,
    attrs: attrsDiff,
    style: styleDiff,
    childs: diffChilds,
  }
}
