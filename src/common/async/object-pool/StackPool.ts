/** LIFO storage (Last-In, First-Out) for pooled objects */
export interface IStackPool<TObject> {
  readonly objects: ReadonlyArray<TObject>
  readonly size: number

  get(count: number): TObject[]

  release(objects: TObject[], start?: null | number, end?: null | number): void
}

export class StackPool<TObject> implements IStackPool<TObject> {
  private readonly _objects: TObject[] = []

  get objects(): ReadonlyArray<TObject> {
    return this._objects
  }

  get size() {
    return this._objects.length
  }

  get(count: number): TObject[] {
    const len = this._objects.length
    if (count > len) {
      count = len
    }
    const start = len - count
    const objects = this._objects.slice(start)
    this._objects.length = start
    return objects
  }

  release(objects: TObject[], start?: null | number, end?: null | number) {
    if (start == null) {
      start = 0
    }
    if (end == null) {
      end = objects.length
    }
    for (let i = start; i < end; i++) {
      const obj = objects[i]
      if (obj != null) {
        this._objects.push(obj)
      }
    }
  }
}
