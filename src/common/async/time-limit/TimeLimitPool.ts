import { type IDateTime, dateTimeReal } from 'src/common/time/date-time'
import { delay } from 'src/common/async/wait/delay'
import { PoolWrapper } from 'src/common/async/pool/PoolWrapper'
import { type IPool } from 'src/common/async/pool/Pool'

export interface ITimeLimitPool extends IPool {
  readonly time: number
}

export type TimeLimitPoolParams = {
  pool: IPool
  time: number
  dateTime?: null | IDateTime
}

export class TimeLimitPool extends PoolWrapper implements ITimeLimitPool {
  private readonly _time: number
  private readonly _dateTime: IDateTime

  constructor({ pool, time, dateTime }: TimeLimitPoolParams) {
    super(pool)
    this._time = time
    this._dateTime = dateTime ?? dateTimeReal
  }

  get time(): number {
    return this._time
  }

  async release(count: number, dontThrow?: null | boolean): Promise<number> {
    await delay(this._time, null, this._dateTime)
    return await this._pool.release(count, dontThrow)
  }
}
