import { IPool, Pool } from '@flemist/time-limits'
import os from 'node:os'

// TODO: write doc comments
export const poolFs: IPool = new Pool(os.cpus().length)
