// noinspection PointlessBitwiseExpressionJS

// from here: https://stackoverflow.com/a/47593316/5221762
/** @param seed - integer number in range: [-2147483648, 2147483647] */
function mulberry32(seed: number): () => number {
  return function _mulberry32() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    // return ((t ^ (t >>> 14)) >>> 0) / 4294967296 + 0.5
    return (t ^ (t >>> 14)) / 4294967296 + 0.5
  }
}

function randomWithoutSeed() {
  return Math.random()
}

export function getRandomSeed(): number {
  // from: https://stackoverflow.com/a/47593316/5221762
  return (Math.random() * (2 ** 32)) >>> 0
}

export function getRandomFunc(seed?: null | number) {
  return seed != null ? mulberry32(seed) : randomWithoutSeed
}

/**
 * Generate random number in range [0..1) like Math.random() or other,
 * but can be pseudorandom with seed
 */
export class Random {
  private readonly _seed: number | null | undefined
  private readonly _rnd: () => number

  constructor(seed?: null | number) {
    this._seed = seed
    this._rnd = getRandomFunc(seed)
  }

  get seed(): number | null | undefined {
    return this._seed
  }

  nextSeed(): number {
    // return Math.floor(this.next() * (2 << 29)) // откуда здесь 29 - не помню
    // from: https://stackoverflow.com/a/47593316/5221762
    return (this.next() * (2 ** 32)) >>> 0
  }

  nextRandom(): Random {
    return new Random(this.nextSeed())
  }

  next(): number {
    return this._rnd()
  }

  clone(): Random {
    return new Random(this._seed)
  }
}
