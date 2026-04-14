import type { Converter } from './types'

export const converterJson: Converter<any, string> = {
  to: from => JSON.stringify(from, null, 2),
  from: to => JSON.parse(to),
}
