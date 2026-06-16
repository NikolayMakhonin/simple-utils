import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import { delay } from 'src/common/async/wait/delay'
import { PoolWrapper } from 'src/common/async/pool/PoolWrapper'
import { type IPool } from 'src/common/async/pool/Pool'

export interface ITimeLimitPool extends IPool {
  time: number
}

export type TimeLimitPoolParams = {
  pool: IPool
  time: number
  timeController?: null | ITimeController
}

export class TimeLimitPool extends PoolWrapper implements ITimeLimitPool {
  private readonly _time: number
  private readonly _timeController: ITimeController

  constructor({ pool, time, timeController }: TimeLimitPoolParams) {
    super(pool)
    this._time = time
    this._timeController = timeController || timeControllerDefault
  }

  get time(): number {
    return this._time
  }

  async release(count: number, dontThrow?: null | boolean): Promise<number> {
    await delay(this._time, null, this._timeController)
    return await this._pool.release(count, dontThrow)
  }
}
