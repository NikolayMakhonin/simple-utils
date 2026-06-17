import type { IValueState } from './contracts'

export class ValueState<TValue> implements IValueState<TValue> {
  private constructor(props: IValueState<TValue> = {}) {
    this.value = props.value
    this.loading = props.loading || false
    this.hasValue = props.hasValue || false
    this.error = props.error
    this.hasError = props.hasError || false
  }

  value?: TValue
  loading?: null | boolean
  hasValue?: null | boolean
  error?: any
  hasError?: null | boolean

  get [Symbol.toStringTag]() {
    return 'ValueState' as const
  }
}
