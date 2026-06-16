import { isWeakKey } from './isWeakKey'
import { type IWeakOrMap, WeakOrMap } from './WeakOrMap'

type HeldKey<K> = K | WeakRef<K & object>

/**
 * Key-value map accepting keys of any type
 * Additionally, if a value is an object, the entry will be removed
 * when the value is garbage collected
 */
export class WeakOrMapFull<K, V> implements IWeakOrMap<K, V> {
  private readonly _entries: IWeakOrMap<K, V | WeakRef<V & object>>
  private readonly _registry: FinalizationRegistry<HeldKey<K>>

  constructor() {
    this._entries = new WeakOrMap()
    this._registry = new FinalizationRegistry<HeldKey<K>>(heldKey => {
      let key: K
      if (heldKey instanceof WeakRef) {
        const deref = heldKey.deref()
        if (deref === void 0) {
          return
        }
        key = deref
      } else {
        key = heldKey
      }
      const entry = this._entries.get(key)
      if (entry instanceof WeakRef && entry.deref() === void 0) {
        this._entries.delete(key)
      }
    })
  }

  get(key: K): V | undefined {
    const entry = this._entries.get(key)
    if (entry instanceof WeakRef) {
      return entry.deref()
    }
    return entry
  }

  has(key: K): boolean {
    const entry = this._entries.get(key)
    if (entry instanceof WeakRef) {
      // FinalizationRegistry callback is called asynchronously,
      // so entry can be already collected, but not yet removed from the map
      return entry.deref() !== void 0
    }
    return this._entries.has(key)
  }

  set(key: K, value: V): this {
    const prev = this._entries.get(key)
    if (prev instanceof WeakRef) {
      this._registry.unregister(prev)
    }
    if (isWeakKey(value)) {
      const ref = new WeakRef(value)
      this._entries.set(key, ref)
      const heldKey: HeldKey<K> = isWeakKey(key) ? new WeakRef(key) : key
      this._registry.register(value, heldKey, ref)
    } else {
      this._entries.set(key, value)
    }
    return this
  }

  delete(key: K): boolean {
    const prev = this._entries.get(key)
    if (prev instanceof WeakRef) {
      this._registry.unregister(prev)
    }
    return this._entries.delete(key)
  }
}
