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
  return new Derived([source], ([value], emit) => {
    emit(value)
    return EMPTY_FUNC
  })
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

derivedOrValues(
  [staticObservable(1), '2'],
  ([value1, value2]) => `${value1}${value2}`,
).subscribe(value => {
  console.log(value)
})

derived(
  [staticObservable(1), '2'],
  ([value1, value2], set) => {
    set(`${value1}${value2}`)
    return EMPTY_FUNC
  },
  '',
).subscribe(value => {
  console.log(value)
})
