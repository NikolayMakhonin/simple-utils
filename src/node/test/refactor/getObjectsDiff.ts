export const DIFF_OLD = '-'
export const DIFF_NEW = '+'

export function getObjectsDiff(
  valueOld,
  valueNew,
  handleDiff?: null | ((valueOld, valueNew, diffs: any) => any),
) {
  if (valueOld === valueNew) {
    return null
  }
  if (Array.isArray(valueOld)) {
    if (Array.isArray(valueNew)) {
      let diffs: any[] | null = null

      for (
        let i = 0, len = Math.max(valueNew.length, valueNew.length);
        i < len;
        i++
      ) {
        const diff = getObjectsDiff(valueOld[i], valueNew[i], handleDiff)
        if (diff != null) {
          if (!diffs) {
            diffs = []
          }
          diffs.push(diff)
        }
      }

      if (diffs != null && handleDiff) {
        diffs = handleDiff(valueOld, valueNew, diffs)
      }

      return diffs
    }
  } else if (valueOld instanceof Object) {
    if (valueNew instanceof Object) {
      let diffs: Record<string, any> | null = null

      for (const key in valueOld) {
        if (Object.prototype.hasOwnProperty.call(valueOld, key)) {
          const diff = getObjectsDiff(valueOld[key], valueNew[key], handleDiff)
          if (diff != null) {
            if (!diffs) {
              diffs = {}
            }
            diffs[key] = diff
          }
        }
      }
      for (const key in valueNew) {
        if (
          Object.prototype.hasOwnProperty.call(valueNew, key) &&
          !Object.prototype.hasOwnProperty.call(valueOld, key)
        ) {
          const diff = getObjectsDiff(valueOld[key], valueNew[key], handleDiff)
          if (diff != null) {
            if (!diffs) {
              diffs = {}
            }
            diffs[key] = diff
          }
        }
      }

      if (diffs != null && handleDiff) {
        diffs = handleDiff(valueOld, valueNew, diffs)
      }

      return diffs
    }
  }

  let diffs = {
    [DIFF_OLD]: valueOld,
    [DIFF_NEW]: valueNew,
  }

  if (handleDiff) {
    diffs = handleDiff(valueOld, valueNew, diffs)
  }

  return diffs
}
