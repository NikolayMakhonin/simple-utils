import { type IPool, Pool } from 'src/common/async/pool/Pool'
import os from 'node:os'

// TODO: write doc comments
export const poolFs: IPool = new Pool(os.cpus().length)
