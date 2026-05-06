import type { IValueState } from './contracts'

export class ValueState<TValue> implements IValueState<TValue> {
  private constructor(props: IValueState<TValue> = {}) {
    this.value = props.value
    this.loading = props.loading || false
    this.hasValue = props.hasValue || false
    this.error = props.error
    this.hasError = props.hasError || false
  }

  value?: TValue | null
  loading?: boolean | null
  hasValue?: boolean | null
  error?: any
  hasError?: boolean | null

  get [Symbol.toStringTag]() {
    return 'ValueState' as const
  }
}
