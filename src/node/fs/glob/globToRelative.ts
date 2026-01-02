import * as path from 'path'
import { pathNormalize } from 'src/node/fs/pathNormalize'

// /glob => <relativePath>/glob
// ./dir/glob => <relativePath>/dir/glob
// ../glob => <relativePath>/../glob
// **/glob => <relativePath>/**/glob
// *.glob => <relativePath>/**/*.glob
// glob => <relativePath>/**/glob
/**
 *  @param glob - .gitignore glob pattern
 *  @param relativePath - relative path from the directory where the glob should be applied
 *  @return - glob pattern relative to the given path
 */
export function globToRelative(glob: string, relativePath: string): string {
  if (!relativePath || relativePath === '.') {
    return glob
  }
  const exclude = glob.startsWith('^')
  if (exclude) {
    glob = glob.substring(1)
  }
  const negative = glob.startsWith('!')
  if (negative) {
    glob = glob.substring(1)
  }

  if (glob.startsWith('/')) {
    if (relativePath.endsWith('/')) {
      relativePath = relativePath.substring(0, relativePath.length - 1)
    }
    glob = relativePath + glob
  } else {
    if (!relativePath.endsWith('/')) {
      relativePath += '/'
    }
    if (glob.startsWith('./')) {
      glob = relativePath + glob.substring(2)
    } else if (glob.startsWith('../')) {
      glob = relativePath + glob
    } else {
      if (relativePath.startsWith('..')) {
        relativePath = ''
      }
      if (glob.startsWith('**')) {
        glob = relativePath + glob
      } else {
        glob = relativePath + '**/' + glob
      }
    }
  }

  glob = pathNormalize(path.normalize(glob))

  if (negative) {
    glob = '!' + glob
  }
  if (exclude) {
    glob = '^' + glob
  }
  return glob
}
