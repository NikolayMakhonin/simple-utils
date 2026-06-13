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

    // Emit notifies invalidate callbacks before delivering the value
    subject.emit(1)
    expect(events).toEqual(['invalidate', 'value 1'])

    // Invalidate notifies once until the next emit
    subject.invalidate()
    subject.invalidate()
    expect(events).toEqual(['invalidate', 'value 1', 'invalidate'])

    // Emit of a stale subject delivers the value without repeated invalidate
    subject.emit(2)
    expect(events).toEqual(['invalidate', 'value 1', 'invalidate', 'value 2'])

    // Emit of a valid subject invalidates again
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
    // The current value is stale, the subscriber learns it immediately
    expect(events).toEqual(['value 1', 'invalidate'])

    subject.emit(2)
    expect(events).toEqual(['value 1', 'invalidate', 'value 2'])

    unsubscribe()
  })

  it('clean clears the retained value and stale flag after the last unsubscribe', () => {
    const subject = new Subject<number>({
      emitLastEvent: true,
      autoClear: true,
    })
    const events: string[] = []
    const unsubscribe = subject.subscribe(o => {
      events.push(`value ${o}`)
    })
    subject.emit(1)
    subject.invalidate()
    expect(subject.hasLast).toBe(true)

    unsubscribe()
    expect(subject.hasLast).toBe(false)

    // A new subscriber receives neither the cleared value nor the cleared stale flag
    const unsubscribeRestarted = subject.subscribe(
      o => {
        events.push(`restarted value ${o}`)
      },
      () => {
        events.push('restarted invalidate')
      },
    )
    expect(events).toEqual(['value 1'])

    subject.emit(2)
    expect(events).toEqual([
      'value 1',
      'restarted invalidate',
      'restarted value 2',
    ])
    unsubscribeRestarted()
  })
})
