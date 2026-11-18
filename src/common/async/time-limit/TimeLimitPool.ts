import { type IClock, clockReal } from 'src/common/time/clock'
import { delay } from 'src/common/async/wait/delay'
import { PoolWrapper } from 'src/common/async/pool/PoolWrapper'
import { type IPool } from 'src/common/async/pool/Pool'

export interface ITimeLimitPool extends IPool {
  readonly time: number
}

export type TimeLimitPoolOptions = {
  pool: IPool
  time: number
  clock?: null | IClock
}

export class TimeLimitPool extends PoolWrapper implements ITimeLimitPool {
  private readonly _time: number
  private readonly _clock: IClock

  constructor({ pool, time, clock }: TimeLimitPoolOptions) {
    super(pool)
    this._time = time
    this._clock = clock ?? clockReal
  }

  get time(): number {
    return this._time
  }

  async release(count: number, dontThrow?: null | boolean): Promise<number> {
    await delay(this._time, null, this._clock)
    return await this._pool.release(count, dontThrow)
  }
}
