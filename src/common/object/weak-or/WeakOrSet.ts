import { isWeakKey } from './isWeakKey'

/** Set accepting values of any type */
export interface IWeakOrSet<T> {
  has(value: T): boolean
  add(value: T): this
  delete(value: T): boolean
}

export class WeakOrSet<T> implements IWeakOrSet<T> {
  private readonly _strong = new Set<T>()
  private readonly _weak = new WeakSet<T & object>()

  has(value: T): boolean {
    return isWeakKey(value) ? this._weak.has(value) : this._strong.has(value)
  }

  add(value: T): this {
    if (isWeakKey(value)) {
      this._weak.add(value)
    } else {
      this._strong.add(value)
    }
    return this
  }

  delete(value: T): boolean {
    return isWeakKey(value)
      ? this._weak.delete(value)
      : this._strong.delete(value)
  }
}
