import { describe, expect, it } from 'vitest'
import { Derived } from './Derived'
import { Subject } from './Subject'

function createSource<T>(value: T): Subject<T> {
  return new Subject<T>({ emitLastEvent: true, hasLast: true, last: value })
}

describe('Derived', () => {
  it('base', () => {
    const source1 = createSource(1)
    const source2 = createSource(10)
    const derived = new Derived(
      [source1, source2, 100],
      ([value1, value2, value3]) => value1 + value2 + value3,
    )
    const results: number[] = []
    const unsubscribe = derived.subscribe(o => {
      results.push(o)
    })
    expect(results).toEqual([111])

    source1.emit(2)
    expect(results).toEqual([111, 112])

    source2.emit(20)
    expect(results).toEqual([111, 112, 122])

    // Emission with an unchanged value still computes and emits
    source1.emit(2)
    expect(results).toEqual([111, 112, 122, 122])

    unsubscribe()
    expect(source1.hasListeners).toBe(false)
    expect(source2.hasListeners).toBe(false)
    source1.emit(3)
    expect(results).toEqual([111, 112, 122, 122])

    // Resubscription computes from current values without a stale initial
    // delivery, because the retained value was cleared on the last unsubscribe
    const resultsRestarted: number[] = []
    const unsubscribeRestarted = derived.subscribe(o => {
      resultsRestarted.push(o)
    })
    expect(resultsRestarted).toEqual([123])
    unsubscribeRestarted()
  })

  it('clean disabled retains the last value', () => {
    const source = createSource(1)
    const derived = new Derived([source], ([o]) => o * 2, {
      dontAutoClear: false,
    })
    const results: number[] = []
    const unsubscribe = derived.subscribe(o => {
      results.push(o)
    })
    expect(results).toEqual([2])

    unsubscribe()
    source.emit(3)

    // Resubscription delivers the retained last value, then computes from current values
    const resultsRestarted: number[] = []
    const unsubscribeRestarted = derived.subscribe(o => {
      resultsRestarted.push(o)
    })
    expect(resultsRestarted).toEqual([2, 6])
    unsubscribeRestarted()
  })

  it('diamond with branches of different length', () => {
    const source = createSource(1)
    const short = new Derived([source], ([o]) => ({ source: o }))
    const chain1 = new Derived([source], ([o]) => ({ source: o }))
    const chain2 = new Derived([chain1], ([o]) => ({ source: o.source }))
    const long = new Derived([chain2], ([o]) => ({ source: o.source }))
    const computations: [number, number][] = []
    const combined = new Derived([short, long], ([shortValue, longValue]) => {
      computations.push([shortValue.source, longValue.source])
      return [shortValue.source, longValue.source]
    })
    const unsubscribe = combined.subscribe(() => {})
    expect(computations).toEqual([[1, 1]])

    // One computation per change, never from two different source values
    source.emit(2)
    expect(computations).toEqual([
      [1, 1],
      [2, 2],
    ])

    source.emit(3)
    expect(computations).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ])

    unsubscribe()
  })

  it('overlapping cascades', () => {
    const source1 = createSource(1)
    const source2 = createSource(10)
    const branch1 = new Derived([source1], ([o]) => o * 2)
    const branch2 = new Derived([source2], ([o]) => o * 2)
    const computations: [number, number][] = []
    const combined = new Derived([branch1, branch2], ([value1, value2]) => {
      computations.push([value1, value2])
      return [value1, value2]
    })
    const unsubscribeCombined = combined.subscribe(() => {})
    // Source2 emits inside the invalidation cascade of source1
    const unsubscribeSpy = branch1.subscribe(
      () => {},
      () => {
        source2.emit(11)
      },
    )
    expect(computations).toEqual([[2, 20]])

    // Both cascades settle into a single consistent computation
    source1.emit(2)
    expect(computations).toEqual([
      [2, 20],
      [4, 22],
    ])

    unsubscribeSpy()
    unsubscribeCombined()
  })

  it('waits for the first delivery from every source', () => {
    const source1 = createSource(1)
    const source2 = new Subject<number>()
    const events: string[] = []
    const derived = new Derived(
      [source1, source2],
      ([value1, value2]) => value1 + value2,
    )
    const unsubscribe = derived.subscribe(
      o => {
        events.push(`value ${o}`)
      },
      () => {
        events.push('invalidate')
      },
    )
    // source2 has delivered nothing yet: the computation is deferred,
    // the subscriber is notified that the value is pending
    expect(events).toEqual(['invalidate'])

    source2.emit(10)
    expect(events).toEqual(['invalidate', 'value 11'])

    source1.emit(2)
    expect(events).toEqual(['invalidate', 'value 11', 'invalidate', 'value 12'])

    unsubscribe()
  })

  it('subscription while a source is stale', () => {
    const source = createSource(1)
    source.invalidate()

    const results: number[] = []
    const derived = new Derived([source], ([o]) => o * 2)
    const unsubscribe = derived.subscribe(o => {
      results.push(o)
    })
    // The initial computation is deferred until the source revalidates
    expect(results).toEqual([])

    source.emit(2)
    expect(results).toEqual([4])

    unsubscribe()
  })

  it('invalidation with unchanged computed value', () => {
    const source = createSource(1)
    const constant = new Derived([source], () => 'constant')
    const computations: [number, string][] = []
    const combined = new Derived(
      [source, constant],
      ([sourceValue, constantValue]) => {
        computations.push([sourceValue, constantValue])
        return [sourceValue, constantValue]
      },
    )
    const unsubscribe = combined.subscribe(() => {})
    expect(computations).toEqual([[1, 'constant']])

    // Constant re-emits an equal value, the combined computation is not deadlocked
    source.emit(2)
    expect(computations).toEqual([
      [1, 'constant'],
      [2, 'constant'],
    ])

    unsubscribe()
  })
})
