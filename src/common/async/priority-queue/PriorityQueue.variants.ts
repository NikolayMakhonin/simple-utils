import { describe, it, assert } from 'vitest'
import { PriorityQueue } from './PriorityQueue'
import { priorityCreate } from 'src/common/async/priority/Priority'
import { createTestVariants } from '@flemist/test-variants'
import {
  type IAbortSignalFast,
  type IAbortControllerFast,
  AbortControllerFast,
} from '@flemist/abort-controller-fast'
import {
  type ITimeController,
  TimeControllerMock,
} from '@flemist/time-controller'
import { delay } from 'src/common/async/wait'
import {
  getRandomSeed,
  Random,
  randomBoolean,
  randomInt,
  randomItem,
} from 'src/common/random'

type TestVariantsArgs = {
  seed: number

  // TODO
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
      // Ignore re-run error, throw original
    }
    throw err
  }
})

type GenerateContextOptions = {
  rnd: Random
  args: TestVariantsArgs
  log: boolean
}

function generateContext(options: GenerateContextOptions): TestContext {
  const { args, log } = options

  // TODO

  return {
    // TODO
  }
}

type TestContext = {
  // TODO
}

type TestOptions = {
  rnd: Random
  context: TestContext
  args: TestVariantsArgs
}

function test(options: TestOptions): void {
  const { rnd, context, args } = options

  // TODO
}

describe('PriorityQueue', async () => {
  it('variants', async () => {
    await testVariants({
      // TODO
    })({
      limitTime: 60 * 1000,
      parallel: 1,
      cycles: 1e9,
      getSeed: () => getRandomSeed(),
      timeout: 1000,
      findBestError: {
        limitArgOnError: true,
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
        dir: 'tmp/test/PriorityQueue/variants',
        attemptsPerVariant: 10,
        useToFindBestError: false,
      },
    })
  })
})
