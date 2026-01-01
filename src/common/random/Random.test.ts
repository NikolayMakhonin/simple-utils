// noinspection PointlessBitwiseExpressionJS
import { describe, it, expect } from 'vitest'
import { Random } from './Random'

describe('Random', () => {
  it('stats', () => {
    const statsExpected = {
      sum: 0,
      sumSqr: 0,
      count: 0,
      avg: 0,
      dispersion: 0,
    }
    const statsActual = {
      sum: 0,
      sumSqr: 0,
      count: 0,
      avg: 0,
      dispersion: 0,
    }
    const rnd = new Random(0)
    const startTime = Date.now()
    while (Date.now() - startTime < 1000) {
      for (let i = 0; i < 1000; i++) {
        const valueActual = rnd.next()
        statsActual.sum += valueActual
        statsActual.sumSqr += valueActual * valueActual
        statsActual.count++
        const valueExpected = Math.random()
        statsExpected.sum += valueExpected
        statsExpected.sumSqr += valueExpected * valueExpected
        statsExpected.count++
      }
    }
    statsActual.avg = statsActual.sum / statsActual.count
    statsActual.dispersion =
      statsActual.sumSqr / statsActual.count - statsActual.avg ** 2
    statsExpected.avg = statsExpected.sum / statsExpected.count
    statsExpected.dispersion =
      statsExpected.sumSqr / statsExpected.count - statsExpected.avg ** 2
    console.log('[test][Random] stats', {
      expected: statsExpected,
      actual: statsActual,
    })
    expect(statsActual.avg).toBeCloseTo(statsExpected.avg, 3)
    expect(statsActual.dispersion).toBeCloseTo(statsExpected.dispersion, 3)
  })
})
