import type { MatchResult3 } from './types'

export type MatcherArgsName<T> = string | ((actual?: T) => string) | null

export type MatcherArgs<T> = {
  name?: MatcherArgsName<T>
}

export abstract class Matcher<
  Actual,
  Args extends MatcherArgs<any> | null | undefined = any,
> {
  protected _args: Args

  public constructor(args?: Args) {
    this._args = args && ({ ...args } as any)
  }

  set(args: Partial<Args>): this {
    this._args = {
      ...(this._args ?? {}),
      ...args,
    } as any
    return this
  }

  name(name?: MatcherArgsName<Actual>) {
    return this.set({ name } as any)
  }

  abstract match(actual: Actual): MatchResult3

  protected abstract nameDefault(actual?: Actual): string

  toString(actual?: Actual): string {
    const name = this._args?.name
    if (!name) {
      return this.nameDefault(actual)
    }
    if (typeof name === 'string') {
      return name
    }
    return name(actual)
  }
}
