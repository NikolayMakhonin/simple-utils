export function setOwnProperty(
  obj: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (key === '__proto__') {
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  } else {
    obj[key] = value
  }
}
