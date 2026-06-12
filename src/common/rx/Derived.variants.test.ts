/**
 * Logging: disabled by default, enabled only on error (test re-runs with log: true)
 *
 * General format:
 * - Log entries: bracket-path style with [test] prefix
 *
 * Entity naming:
 * - Sources: s{index}, e.g. s0, s1
 * - Derived nodes: d{index}, e.g. d0, d3
 *
 * Actions:
 * - createSource/createDerived - graph construction with dependencies
 * - toggle - sink test listener subscribed (on=true) or unsubscribed (on=false)
 * - emit - source emission starting a cascade
 * - compute - derived computation with merged per-source generations
 *
 * Parameters:
 * - [i] - iteration index
 * - gen - source generation number
 * - dependencies - dependency node names
 * - values - computed per-source generations
 *
 * Example trace:
 * [test] createSource name=s0
 * [test] createDerived name=d0 dependencies=[s0]
 * [test] createDerived name=d1 dependencies=[s0, d0]
 * [test][emit][0] source=s0 gen=1
 * [test] compute name=d0 values={"s0":1}
 * [test] compute name=d1 values={"s0":1}
 */
import { describe, it } from 'vitest'
import { createTestVariants } from '@flemist/test-variants'
import {
  getRandomSeed,
  Random,
  randomBoolean,
  randomInt,
  randomItem,
  randomItems,
} from 'src/common/random'
import type { Unsubscribe } from 'src/common/types/common'
import type { IObservable } from './types'
import { Derived } from './Derived'
import { Subject } from './Subject'

/** Per-source generation numbers visible through a node */
type Generations = Record<string, number>

export type TestVariantsArgs = {
  seed: number
  sourceCountMax: number
  derivedCountMax: number
  dependencyCountMax: number
  iterationsMax: number
  toggleSinks: boolean
}

const testVariants = createTestVariants(async (args: TestVariantsArgs) => {
  const rnd = new Random(args.seed)
  try {
    const context = generateContext({ rnd: rnd.clone(), args, log: false })
    test({ rnd: rnd.clone(), context, args })
  } catch (err) {
    try {
      const context = generateContext({ rnd: rnd.clone(), args, log: true })
      test({ rnd: rnd.clone(), context, args })
    } catch {
      // ignore re-run error, throw original
    }
    throw err
  }
})

type GraphNode = {
  name: string
  observable: IObservable<Generations>
  reachableSourceNames: Set<string>
}

type SourceNode = GraphNode & {
  subject: Subject<Generations>
}

type DerivedNode = GraphNode & {
  derived: Derived<IObservable<Generations>[], Generations>
  dependencyNames: string[]
  isSink: boolean
}

type TestContext = {
  log: boolean
  sources: SourceNode[]
  deriveds: DerivedNode[]
  generations: Generations
  computeCounts: Record<string, number>
  values: Record<string, Generations>
  listenerOn: Record<string, boolean>
  listenerUnsubscribes: Record<string, Unsubscribe | null>
}

type GenerateContextOptions = {
  rnd: Random
  args: TestVariantsArgs
  log: boolean
}

function generateContext(options: GenerateContextOptions): TestContext {
  const { rnd, args, log } = options

  const sources: SourceNode[] = []
  const deriveds: DerivedNode[] = []
  const nodes: GraphNode[] = []
  const generations: Generations = {}
  const computeCounts: Record<string, number> = {}
  const values: Record<string, Generations> = {}
  const listenerOn: Record<string, boolean> = {}
  const listenerUnsubscribes: Record<string, Unsubscribe | null> = {}

  const sourceCount = randomInt(rnd, 1, args.sourceCountMax + 1)
  for (let i = 0; i < sourceCount; i++) {
    const name = `s${i}`
    generations[name] = 0
    const source: SourceNode = {
      name,
      subject: new Subject<Generations>({
        emitLastEvent: true,
        hasLast: true,
        last: { [name]: 0 },
      }),
      observable: null!,
      reachableSourceNames: new Set([name]),
    }
    source.observable = source.subject
    sources.push(source)
    nodes.push(source)
    if (log) {
      console.log(`[test] createSource name=${name}`)
    }
  }

  const derivedCount = randomInt(rnd, 1, args.derivedCountMax + 1)
  for (let i = 0; i < derivedCount; i++) {
    const name = `d${i}`
    const dependencyCount = randomInt(
      rnd,
      1,
      Math.min(args.dependencyCountMax, nodes.length) + 1,
    )
    const dependencies = randomItems(rnd, nodes, dependencyCount)
    const reachableSourceNames = new Set<string>()
    dependencies.forEach(dependency => {
      dependency.reachableSourceNames.forEach(sourceName => {
        reachableSourceNames.add(sourceName)
      })
    })
    computeCounts[name] = 0
    const derived = new Derived(
      dependencies.map(o => o.observable),
      inputs => {
        const merged: Generations = {}
        inputs.forEach(input => {
          for (const sourceName in input) {
            if (!Object.prototype.hasOwnProperty.call(input, sourceName)) {
              continue
            }
            const generation = input[sourceName]
            if (
              merged[sourceName] != null &&
              merged[sourceName] !== generation
            ) {
              throw new Error(
                `${name} computed from mixed generations of ${sourceName}` +
                  `: ${merged[sourceName]} and ${generation}`,
              )
            }
            merged[sourceName] = generation
          }
        })
        computeCounts[name]++
        if (log) {
          console.log(
            `[test] compute name=${name} values=${JSON.stringify(merged)}`,
          )
        }
        return merged
      },
    )
    const derivedNode: DerivedNode = {
      name,
      observable: derived,
      reachableSourceNames,
      derived,
      dependencyNames: dependencies.map(o => o.name),
      isSink: true,
    }
    deriveds.push(derivedNode)
    nodes.push(derivedNode)
    if (log) {
      console.log(
        `[test] createDerived name=${name} dependencies=[${derivedNode.dependencyNames.join(', ')}]`,
      )
    }
  }

  const usedDependencyNames = new Set(deriveds.flatMap(o => o.dependencyNames))
  deriveds.forEach(derivedNode => {
    derivedNode.isSink = !usedDependencyNames.has(derivedNode.name)
  })

  deriveds.forEach(derivedNode => {
    listenerOn[derivedNode.name] = true
    listenerUnsubscribes[derivedNode.name] = derivedNode.derived.subscribe(
      o => {
        values[derivedNode.name] = o
      },
    )
  })

  return {
    log,
    sources,
    deriveds,
    generations,
    computeCounts,
    values,
    listenerOn,
    listenerUnsubscribes,
  }
}

type TestOptions = {
  rnd: Random
  context: TestContext
  args: TestVariantsArgs
}

function test(options: TestOptions): void {
  const { rnd, context, args } = options
  const {
    log,
    sources,
    deriveds,
    generations,
    computeCounts,
    values,
    listenerOn,
    listenerUnsubscribes,
  } = context

  const iterations = randomInt(rnd, 1, args.iterationsMax + 1)
  for (let i = 0; i < iterations; i++) {
    if (args.toggleSinks) {
      deriveds.forEach(derivedNode => {
        if (!derivedNode.isSink || !randomBoolean(rnd, 0.3)) {
          return
        }
        const name = derivedNode.name
        if (listenerOn[name]) {
          listenerUnsubscribes[name]!()
          listenerUnsubscribes[name] = null
          listenerOn[name] = false
        } else {
          listenerUnsubscribes[name] = derivedNode.derived.subscribe(o => {
            values[name] = o
          })
          listenerOn[name] = true
        }
        if (log) {
          console.log(`[test][${i}] toggle name=${name} on=${listenerOn[name]}`)
        }
      })
    }

    const outerSource = randomItem(rnd, sources)

    deriveds.forEach(derivedNode => {
      computeCounts[derivedNode.name] = 0
    })

    const generation = ++generations[outerSource.name]
    if (log) {
      console.log(
        `[test][emit][${i}] source=${outerSource.name} gen=${generation}`,
      )
    }
    outerSource.subject.emit({ [outerSource.name]: generation })

    deriveds.forEach(derivedNode => {
      const name = derivedNode.name
      const isLive = !derivedNode.isSink || listenerOn[name]
      const isAffected =
        isLive && derivedNode.reachableSourceNames.has(outerSource.name)
      const countExpected = isAffected ? 1 : 0
      const count = computeCounts[name]
      if (count !== countExpected) {
        throw new Error(
          `[${i}] ${name} compute count: expected ${countExpected}, actual ${count}`,
        )
      }

      if (derivedNode.isSink && !listenerOn[name]) {
        return
      }
      const value = values[name]
      derivedNode.reachableSourceNames.forEach(sourceName => {
        if (value[sourceName] !== generations[sourceName]) {
          throw new Error(
            `[${i}] ${name} value of ${sourceName}` +
              `: expected ${generations[sourceName]}, actual ${value[sourceName]}` +
              `; value=${JSON.stringify(value)}`,
          )
        }
      })
      for (const sourceName in value) {
        if (!Object.prototype.hasOwnProperty.call(value, sourceName)) {
          continue
        }
        if (!derivedNode.reachableSourceNames.has(sourceName)) {
          throw new Error(
            `[${i}] ${name} value contains unreachable source ${sourceName}` +
              `; value=${JSON.stringify(value)}`,
          )
        }
      }
    })
  }
}

describe('Derived', { timeout: 7 * 60 * 60 * 1000 }, () => {
  it('variants', async () => {
    await testVariants({
      sourceCountMax: [1, 2, 3],
      derivedCountMax: [1, 2, 3, 4, 5, 6],
      dependencyCountMax: [1, 2, 3],
      iterationsMax: [5, 10],
      toggleSinks: [false, true],
    })({
      limitTime: 60 * 1000,
      parallel: 1,
      cycles: 1e9,
      getSeed: () => getRandomSeed(),
      timeout: 1000,
      findBestError: {
        limitArgOnError: false,
      },
      iterationModes: [
        {
          mode: 'forward',
          limitTests: 100,
        },
        {
          mode: 'random',
          limitTests: 10000,
        },
        {
          mode: 'backward',
          limitTests: 100,
        },
      ],
      saveErrorVariants: {
        dir: 'tmp/test/Derived/variants',
        attemptsPerVariant: 10,
        useToFindBestError: false,
      },
    })
  })
})
