import * as fs from 'fs'
import * as path from 'path'

// TODO: write doc comments
export function getDrive(path: string): string {
  return path.match(/^[/\\]?[^/\\]+/)![0]
}

// TODO: write doc comments
export function getFileId(path: string, stat: fs.Stats): string {
  return getDrive(path) + '|' + stat.ino
}

// TODO: write doc comments
export function pathResolve(_path: string): string {
  if (_path.endsWith(':')) {
    // если этого не сделать path.resolve заменит "D:" на ".", а потом на текущую папку
    _path += '/'
  }
  return path.resolve(_path)
}
