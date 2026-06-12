import { describe, expect, it } from 'vitest'
import { Subject } from './Subject'

describe('Subject', () => {
  it('base', () => {
    const subject = new Subject<number>({ emitLastEvent: true })
    const results: number[] = []
    const unsubscribe = subject.subscribe(o => {
      results.push(o)
    })
    expect(results).toEqual([])

    subject.emit(1)
    expect(results).toEqual([1])

    const resultsLate: number[] = []
    const unsubscribeLate = subject.subscribe(o => {
      resultsLate.push(o)
    })
    expect(resultsLate).toEqual([1])

    subject.emit(2)
    expect(results).toEqual([1, 2])
    expect(resultsLate).toEqual([1, 2])

    unsubscribe()
    unsubscribeLate()
    subject.emit(3)
    expect(results).toEqual([1, 2])
    expect(resultsLate).toEqual([1, 2])
  })

  it('invalidate', () => {
    const subject = new Subject<number>()
    const events: string[] = []
    const unsubscribe = subject.subscribe(
      o => {
        events.push(`value ${o}`)
      },
      () => {
        events.push('invalidate')
      },
    )

    // emit notifies invalidate callbacks before delivering the value
    subject.emit(1)
    expect(events).toEqual(['invalidate', 'value 1'])

    // invalidate notifies once until the next emit
    subject.invalidate()
    subject.invalidate()
    expect(events).toEqual(['invalidate', 'value 1', 'invalidate'])

    // emit of a stale subject delivers the value without repeated invalidate
    subject.emit(2)
    expect(events).toEqual(['invalidate', 'value 1', 'invalidate', 'value 2'])

    // emit of a valid subject invalidates again
    subject.emit(3)
    expect(events).toEqual([
      'invalidate',
      'value 1',
      'invalidate',
      'value 2',
      'invalidate',
      'value 3',
    ])

    unsubscribe()
    subject.emit(4)
    expect(events.length).toBe(6)
  })

  it('subscribe while invalidated', () => {
    const subject = new Subject<number>({
      emitLastEvent: true,
      hasLast: true,
      last: 1,
    })
    subject.invalidate()

    const events: string[] = []
    const unsubscribe = subject.subscribe(
      o => {
        events.push(`value ${o}`)
      },
      () => {
        events.push('invalidate')
      },
    )
    // the current value is stale, the subscriber learns it immediately
    expect(events).toEqual(['value 1', 'invalidate'])

    subject.emit(2)
    expect(events).toEqual(['value 1', 'invalidate', 'value 2'])

    unsubscribe()
  })
})
