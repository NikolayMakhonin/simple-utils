import { fixFloat } from 'src/common/number/round'

// Это нужно было для кастомного редактора тем оформления,
// нужно ли это сейчас?
export function rgbaToHex(value: string) {
  return value?.replace(
    /\brgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g,
    (_, r, g, b, a) => {
      let hex = `#${(+r).toString(16).padStart(2, '0')}${(+g).toString(16).padStart(2, '0')}${(+b).toString(16).padStart(2, '0')}`
      if (a != null) {
        const alpha = Math.round(parseFloat(a) * 100)
        hex += '/' + alpha
      }
      return hex
    },
  )
}

export function hexToRgba(value: string) {
  return value?.replace(
    /#((?:[a-f\d]{3,4}){1,2})(?:\/(\d+))?\b/gi,
    (_, hex, alpha) => {
      if ((hex.length === 3 || hex.length === 6) && alpha == null) {
        return _
      }
      let r: number
      let g: number
      let b: number
      let a: number | null = null
      if (hex.length === 3 || hex.length === 4) {
        r = parseInt(hex[0] + hex[0], 16)
        g = parseInt(hex[1] + hex[1], 16)
        b = parseInt(hex[2] + hex[2], 16)
        if (hex.length === 4) {
          a = fixFloat(parseInt(hex[3] + hex[3], 16) / 255)
        }
      } else {
        r = parseInt(hex.slice(0, 2), 16)
        g = parseInt(hex.slice(2, 4), 16)
        b = parseInt(hex.slice(4, 6), 16)
        if (hex.length === 8) {
          a = fixFloat(parseInt(hex.slice(6, 8), 16) / 255)
        }
      }
      if (a == null && alpha != null) {
        a = fixFloat(parseInt(alpha) / 100)
      }
      return `rgba(${r}, ${g}, ${b}, ${a})`
    },
  )
}
