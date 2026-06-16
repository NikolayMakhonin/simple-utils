import { isWeakKey } from './isWeakKey'

/** Key-value map accepting keys of any type */
export interface IWeakOrMap<K, V> {
  get(key: K): V | undefined
  has(key: K): boolean
  set(key: K, value: V): this
  delete(key: K): boolean
}

export class WeakOrMap<K, V> implements IWeakOrMap<K, V> {
  private readonly _strong = new Map<K, V>()
  private readonly _weak = new WeakMap<K & object, V>()

  get(key: K): V | undefined {
    return isWeakKey(key) ? this._weak.get(key) : this._strong.get(key)
  }

  has(key: K): boolean {
    return isWeakKey(key) ? this._weak.has(key) : this._strong.has(key)
  }

  set(key: K, value: V): this {
    if (isWeakKey(key)) {
      this._weak.set(key, value)
    } else {
      this._strong.set(key, value)
    }
    return this
  }

  delete(key: K): boolean {
    return isWeakKey(key) ? this._weak.delete(key) : this._strong.delete(key)
  }
}
