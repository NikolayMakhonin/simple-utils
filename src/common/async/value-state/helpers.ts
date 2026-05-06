import { isPromiseLike } from 'src/common/async/promise'
import { ValueState } from './ValueState'
import type {
  AsyncOrValue,
  IValueState,
  OfValueStateOrValues,
  StateOrValue,
  ValueStateUpdater,
} from './contracts'
import type { PromiseOrValue } from 'src/common/types/common'

export function createValueState<TValue>(
  props: IValueState<TValue> = {},
): ValueState<TValue> {
  return new (ValueState as any)(props)
}

export function toValueState<TValue>(value: TValue) {
  return createValueState({
    value,
    hasValue: true,
  })
}

export function toValueStateError<TValue = any>(error: any) {
  return createValueState<TValue>({
    error,
    hasError: true,
  })
}

function resolveValueStates<TValues extends IValueState<any>[]>(
  values: TValues,
): ValueState<OfValueStateOrValues<TValues>> {
  const state = createValueState<OfValueStateOrValues<TValues>>({
    value: [] as any,
    hasValue: true,
  })

  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    if (value instanceof ValueState) {
      state.hasValue &&= value.hasValue
      state.loading ||= value.loading
      state.hasError ||= value.hasError
      state.error ||= value.error
      state.value![i] = value.value
    } else {
      state.value![i] = void 0
      state.hasValue = false
    }
  }

  return state
}

export function resolveValueStatesFunc<
  TValues extends ValueState<any>[],
  TResult,
>(
  values: TValues,
  func: (...values: OfValueStateOrValues<TValues>) => TResult,
): ValueState<TResult> {
  const state = resolveValueStates(values)
  if (state.hasValue) {
    try {
      state.value = func(
        ...(state.value as OfValueStateOrValues<TValues>),
      ) as any
    } catch (error) {
      // console.error(error)
      state.value = void 0
      state.hasValue = false
      state.error = error
      state.hasError = true
    }
  } else {
    state.value = void 0
  }
  return state as ValueState<TResult>
}

export async function asyncToValueState<TValue>(
  valueAsync: AsyncOrValue<TValue>,
  stateOrUpdater?:
    | null
    | ValueState<TValue>
    | ValueStateUpdater<ValueState<TValue>>,
): Promise<ValueState<TValue>> {
  const updater: ValueStateUpdater<ValueState<TValue>> =
    typeof stateOrUpdater === 'function'
      ? stateOrUpdater
      : update => {
          stateOrUpdater = update(stateOrUpdater as ValueState<TValue>)
        }
  let state: ValueState<TValue>

  try {
    updater(o => {
      state = o || createValueState<TValue>()
      state.loading = true
      return state
    })

    const valuePromise: PromiseOrValue<StateOrValue<TValue>> =
      typeof valueAsync === 'function' ? (valueAsync as any)() : valueAsync

    let value: StateOrValue<TValue>

    if (isPromiseLike(valuePromise)) {
      value = await valuePromise
    } else {
      value = valuePromise
    }

    if (value instanceof ValueState) {
      updater(o => {
        state = o || createValueState<TValue>()
        state.value = value.value
        state.hasValue = value.hasValue
        state.error = value.error
        state.hasError = value.hasError
        state.loading = value.loading
        return state
      })
    } else {
      updater(o => {
        state = o || createValueState<TValue>()
        state.value = value as TValue
        state.hasValue = true
        state.error = null
        state.hasError = false
        state.loading = false
        return state
      })
    }
  } catch (error) {
    // console.error(error)
    updater(o => {
      state = o || createValueState<TValue>()
      state.error = error
      state.hasError = true
      state.loading = false
      return state
    })
  }

  return state!
}
