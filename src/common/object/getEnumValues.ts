import type { EnumOf } from 'src/common/types/common'

/**
 * Like Object.values, but without the reverse mapping entries
 * of numeric TypeScript enums
 */
export function getEnumValues<EnumType extends Record<string, any>>(
  enumObject: EnumType,
  options?: null | GetEnumValuesOptions<EnumType>,
): EnumOf<EnumType>[] {
  const filter = options?.filter
  const values: EnumOf<EnumType>[] = []
  for (const key in enumObject) {
    if (Object.prototype.hasOwnProperty.call(enumObject, key)) {
      const value = enumObject[key]
      // Numeric TypeScript enums contain reverse mapping entries: E[E.A = 0] = 'A'
      const isReverseMapping =
        typeof value === 'string' &&
        typeof enumObject[value] === 'number' &&
        String(enumObject[value]) === key
      if (!isReverseMapping && (!filter || filter(value))) {
        values.push(value)
      }
    }
  }
  return values
}

export type GetEnumValuesOptions<EnumType> = {
  filter?: null | ((value: EnumOf<EnumType>) => boolean)
}
