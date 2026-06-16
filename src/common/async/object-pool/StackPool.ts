export interface IStackPool<TObject> {
  readonly objects: ReadonlyArray<TObject>
  readonly size: number

  get(count: number): TObject[]

  release(objects: TObject[], start?: null | number, end?: null | number): void
}

function slice<T>(arr: T[], start: number, end: number): T[] {
  const size = end - start
  const result = new Array<T>(size)
  for (let i = 0; i < size; i++) {
    result[i] = arr[start + i]
  }
  return result
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
    const objects = slice(this._objects, start, start + count)
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
