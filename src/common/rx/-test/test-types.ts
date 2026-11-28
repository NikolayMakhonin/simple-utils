// Compile-time checks of the types that the sources of a Derived give its function.
// A change that breaks the inference of these types fails the type check,
// because tsc reads this file with the rest of src. Nothing imports or runs it
import { expectTypeOf } from 'vitest'
import { Derived } from '../Derived'
import type {
  DerivedFunc,
  DerivedOrValueFunc,
  DerivedOrValuesFunc,
  ObservableOrValue,
  Stores,
} from '../types'
import { staticObservable } from '../staticObservable'
import { EMPTY_FUNC } from 'src/common/constants'
import { isObservable } from '../helpers'

export function derivedOrValues<S extends Stores, T>(
  sources: S,
  func: DerivedOrValuesFunc<S, T>,
  initialValue?: T,
) {
  return new Derived(
    sources,
    values => {
      return func(values)
    },
    {
      last: initialValue,
      hasLast: initialValue !== undefined,
    },
  )
}

export function derivedOrValue<Value, T>(
  source: ObservableOrValue<Value>,
  func: DerivedOrValueFunc<Value, T>,
) {
  if (!isObservable(source)) {
    return func(source)
  }
  return new Derived([source], ([value]) => func(value))
}

export function derived<S extends Stores, T>(
  sources: S,
  func: DerivedFunc<S, T>,
  initialValue?: T,
) {
  return new Derived(sources, func, {
    last: initialValue,
    hasLast: initialValue !== undefined,
  })
}

derivedOrValues([staticObservable(1), '2'], ([value1, value2]) => {
  expectTypeOf(value1).toEqualTypeOf<number>()
  expectTypeOf(value2).toEqualTypeOf<string>()
  return `${value1}${value2}`
})

derivedOrValue(staticObservable(1), value => {
  expectTypeOf(value).toEqualTypeOf<number>()
  return String(value)
})

derivedOrValue(1, value => {
  expectTypeOf(value).toEqualTypeOf<number>()
  return String(value)
})

derived(
  [staticObservable(1), '2'],
  ([value1, value2], set) => {
    expectTypeOf(value1).toEqualTypeOf<number>()
    expectTypeOf(value2).toEqualTypeOf<string>()
    set(`${value1}${value2}`)
    return EMPTY_FUNC
  },
  '',
).subscribe(value => {
  expectTypeOf(value).toEqualTypeOf<string>()
})
