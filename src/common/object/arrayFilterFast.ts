/** Returns the same array if all items pass the predicate */
export function arrayFilterFast<Item, ItemResult extends Item>(
  arr: Item[],
  predicate: (item: Item) => item is ItemResult,
): ItemResult[] {
  let result: ItemResult[] = arr as any
  for (let i = 0, len = arr.length; i < len; i++) {
    const item = arr[i]
    if (predicate(item)) {
      if (result !== arr) {
        result.push(item)
      }
    } else {
      if (result === arr) {
        result = arr.slice(0, i) as any
      }
    }
  }
  return result
}
