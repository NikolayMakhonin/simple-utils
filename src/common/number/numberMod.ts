/** Wraps any value into a circular [0, mod) range, correctly handling negative numbers. */
export function numberMod(value: number, mod: number) {
  return ((value % mod) + mod) % mod
}
