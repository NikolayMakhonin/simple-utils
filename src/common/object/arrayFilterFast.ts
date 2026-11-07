/** Returns the same array if all items pass the predicate */
export function arrayFilterFast<Item, ItemResult extends Item>(
  arr: Item[],
  predicate: (item: Item) => item is ItemResult,
): ItemResult[]
export function arrayFilterFast<Item>(
  arr: Item[],
  predicate: (item: Item) => boolean,
): Item[]
export function arrayFilterFast<Item>(
  arr: Item[],
  predicate: (item: Item) => boolean,
): Item[] {
  let result = arr
  for (let i = 0, len = arr.length; i < len; i++) {
    const item = arr[i]
    if (predicate(item)) {
      if (result !== arr) {
        result.push(item)
      }
    } else {
      if (result === arr) {
        result = arr.slice(0, i)
      }
    }
  }
  return result
}
