import { IPool, Pool } from '@flemist/time-limits'
import os from 'node:os'

export const poolFs: IPool = new Pool(os.cpus().length)
