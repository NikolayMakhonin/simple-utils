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

    // emission with an unchanged value still computes and emits
    source1.emit(2)
    expect(results).toEqual([111, 112, 122, 122])

    unsubscribe()
    expect(source1.hasListeners).toBe(false)
    expect(source2.hasListeners).toBe(false)
    source1.emit(3)
    expect(results).toEqual([111, 112, 122, 122])

    // resubscription delivers the stale last value, then computes from current values
    const resultsRestarted: number[] = []
    const unsubscribeRestarted = derived.subscribe(o => {
      resultsRestarted.push(o)
    })
    expect(resultsRestarted).toEqual([122, 123])
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

    // one computation per change, never from two different source values
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

  it('subscription while a source is stale', () => {
    const source = createSource(1)
    source.invalidate()

    const results: number[] = []
    const derived = new Derived([source], ([o]) => o * 2)
    const unsubscribe = derived.subscribe(o => {
      results.push(o)
    })
    // the initial computation is deferred until the source revalidates
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

    // constant re-emits an equal value, the combined computation is not deadlocked
    source.emit(2)
    expect(computations).toEqual([
      [1, 'constant'],
      [2, 'constant'],
    ])

    unsubscribe()
  })
})
