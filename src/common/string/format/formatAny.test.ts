import { describe, it, expect } from 'vitest'
import { formatAny, type FormatAnyOptions } from './formatAny'
import { getObjectId } from './getObjectId'

describe('formatAny', () => {
  function test(
    value: unknown,
    expected: string,
    options?: null | FormatAnyOptions,
  ) {
    expect(formatAny(value, options)).toBe(expected)
  }

  it('base', () => {
    test(undefined, 'undefined')
    test(null, 'null')
    test(0, '0')
    test(-1.5, '-1.5')
    test(NaN, 'NaN')
    test(true, 'true')
    test(10n, '10n')
    test(Symbol('a'), 'Symbol(a)')
    test('', '')
    test('a', 'a')

    test([], '[]')
    test([1], '[1]')
    test([1, 'a', null, undefined], '[1, "a", null, undefined]')
    test([[1, 2], []], '[[1, 2], []]')

    test({}, '{}')
    test({ a: 1 }, '{a: 1}')
    test({ a: 1, b: 'x', c: [true] }, '{a: 1, b: "x", c: [true]}')
    test({ a: { b: {} } }, '{a: {b: {}}}')
  })

  it('pretty', () => {
    const options = { pretty: true }
    test([], '[]', options)
    test({}, '{}', options)
    test([1, 2], '[\n  1,\n  2\n]', options)
    test(
      { a: 1, b: [1, { c: 2 }], d: {} },
      '{\n  a: 1,\n  b: [\n    1,\n    {\n      c: 2\n    }\n  ],\n  d: {}\n}',
      options,
    )
  })

  it('maxItems', () => {
    test([1, 2, 3], '[1, 2, ...]', { maxItems: 2 })
    test([1, 2], '[1, 2]', { maxItems: 2 })
    test([1, 2], '[...]', { maxItems: 0 })
    test([], '[]', { maxItems: 0 })
    test({ a: 1, b: 2, c: 3 }, '{a: 1, b: 2, ...}', { maxItems: 2 })
    test({ a: 1 }, '{...}', { maxItems: 0 })
    test([1, 2, 3], '[\n  1,\n  2,\n  ...\n]', { maxItems: 2, pretty: true })
    test({ a: [1, 2] }, '{\n  a: [\n    1,\n    ...\n  ]\n}', {
      maxItems: 1,
      pretty: true,
    })
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ])
    test(map, 'Map [["a", 1], ["b", 2]]', { maxItems: 2 })
    test(map, 'Map [["a", 1], ...]', { maxItems: 1 })
    test(map, 'Map [...]', { maxItems: 0 })
  })

  it('filter', () => {
    const filter = (path: string[], value: unknown) => value !== 2
    test([1, 2, 3], '[1, 3]', { filter })
    test({ a: 1, b: 2 }, '{a: 1}', { filter })
    test([1, 3, 2], '[1, 3]', { filter, maxItems: 2 })
    test([1, 2, 3, 4], '[1, 3, ...]', { filter, maxItems: 2 })
    test({ a: { b: 1 } }, '{a: {}}', { filter: path => path.length < 2 })
    test(
      new Map([
        ['a', 1],
        ['b', 2],
        ['c', 3],
      ]),
      'Map [["a", 1], ["c", 3]]',
      { filter },
    )
    test(new Set([1, 2, 3]), 'Set [1, 3]', { filter })
  })

  it('paths seen by filter and customToString', () => {
    function getPaths(value: unknown) {
      const paths: string[] = []
      formatAny(value, {
        filter: path => {
          paths.push(path.join('.'))
          return true
        },
      })
      return paths
    }

    expect(getPaths({ a: [1, { b: 2 }], c: { d: {} }, e: 3 })).toEqual([
      'a',
      'a.0',
      'a.1',
      'a.1.b',
      'c',
      'c.d',
      'e',
    ])
    expect(
      getPaths([new Map([['k', { a: 1 }]]), new Set([{ b: 1 }]), 1]),
    ).toEqual(['0', '0.0', '0.0.a', '1', '1.0', '1.0.b', '2'])

    const paths: string[] = []
    formatAny(
      { a: [1], b: {} },
      {
        customToString: (obj, path) => {
          paths.push(path.join('.'))
        },
      },
    )
    expect(paths).toEqual(['', 'a', 'a.0', 'b'])
  })

  it('maxDepth', () => {
    test({ a: 1 }, 'Object', { maxDepth: 0 })
    test([1], 'Array', { maxDepth: 0 })
    test({ a: { b: 1 }, c: [1] }, '{a: Object, c: Array}', { maxDepth: 1 })
    test(new Map([['a', { b: 1 }]]), 'Map [["a", Object]]', { maxDepth: 1 })
    test(new Set([[1]]), 'Set [Array]', { maxDepth: 1 })
  })

  it('maxStringLength', () => {
    test('abcdef', 'abc', { maxStringLength: 3 })
    test(['abcdef'], '["abc"]', { maxStringLength: 3 })
    test(/abcdef/, '/ab', { maxStringLength: 3 })
    test(function func() {}, 'function', { maxStringLength: 8 })
    test('abcdef', 'ab…', {
      maxStringLength: 3,
      truncateOptions: { appendEllipsis: true },
    })
  })

  it('Map and Set', () => {
    test(new Map(), 'Map []')
    test(
      new Map<unknown, unknown>([
        ['a', 1],
        [2, 'b'],
      ]),
      'Map [["a", 1], [2, "b"]]',
    )
    test(new Map([['a', new Map([['b', 1]])]]), 'Map [["a", Map [["b", 1]]]]')
    test(new Map([['a', { b: 1 }]]), 'Map [\n  ["a", {\n    b: 1\n  }]\n]', {
      pretty: true,
    })
    test(new Set(), 'Set []')
    test(new Set([1, 'a']), 'Set [1, "a"]')
    test(new Set([1, 2, 3]), 'Set [1, ...]', { maxItems: 1 })
  })

  it('showObjectId', () => {
    const options = { showObjectId: true }
    const obj = { a: 1 }
    test(obj, `#${getObjectId(obj)} {a: 1}`, options)
    const arr = [1]
    test(arr, `#${getObjectId(arr)} [1]`, options)
    class Item {
      a = 1
    }
    const item = new Item()
    test(item, `Item#${getObjectId(item)} {a: 1}`, options)
    const map = new Map([['a', 1]])
    test(map, `Map#${getObjectId(map)} [["a", 1]]`, options)
    const set = new Set([1])
    test(set, `Set#${getObjectId(set)} [1]`, options)
    const bytes = new Uint8Array(2)
    test(bytes, `Uint8Array#${getObjectId(bytes)}[2]`, options)
    const error = new Error('msg')
    error.stack = 'Error: msg'
    test(error, `Error#${getObjectId(error)} Error: msg`, options)
  })

  it('showObjectId of values that are not expanded', () => {
    const func = function func() {}
    test(func, `function func#${getObjectId(func)}`, {
      showObjectId: true,
      dontExpandFunctions: true,
    })

    const inner = { b: 1 }
    const outer = { a: inner }
    test(outer, `#${getObjectId(outer)} {a: #${getObjectId(inner)}}`, {
      showObjectId: true,
      maxDepth: 1,
    })

    class Item {
      a = 1
    }
    const item = new Item()
    test(item, `Item#${getObjectId(item)}`, {
      showObjectId: true,
      dontExpandClassInstances: true,
    })
  })

  it('references', () => {
    const obj: Record<string, unknown> = { a: 1 }
    obj.self = obj
    const objId = getObjectId(obj)
    test(obj, `#${objId} {a: 1, self: #${objId}}`)

    const arr: unknown[] = [1]
    arr.push(arr)
    const arrId = getObjectId(arr)
    test(arr, `#${arrId} [1, Array#${arrId}]`)

    const shared = { b: 1 }
    const sharedId = getObjectId(shared)
    test({ x: shared, y: shared }, `{x: #${sharedId} {b: 1}, y: #${sharedId}}`)
    test([shared, [shared]], `[#${sharedId} {b: 1}, [#${sharedId}]]`)

    const map = new Map([['a', shared]])
    const mapId = getObjectId(map)
    test([map, map], `[Map#${mapId} [["a", {b: 1}]], Map#${mapId}]`)

    class Item {
      a = 1
    }
    const item = new Item()
    const itemId = getObjectId(item)
    test([item, item], `[Item#${itemId} {a: 1}, Item#${itemId}]`)

    // Only repeated objects show ids
    test(
      { x: { c: 1 }, y: shared, z: shared },
      `{x: {c: 1}, y: #${sharedId} {b: 1}, z: #${sharedId}}`,
    )

    const objNullPrototype = Object.create(null)
    objNullPrototype.a = 'x'
    objNullPrototype.self = objNullPrototype
    const objNullPrototypeId = getObjectId(objNullPrototype)
    test(
      objNullPrototype,
      `#${objNullPrototypeId} {a: "x", self: #${objNullPrototypeId}}`,
    )

    const nested = Object.create(null)
    nested.child = Object.create(null)
    nested.child.value = 1
    test(nested, '{child: Object}', { maxDepth: 1 })

    // The first occurrence is cut by maxDepth, so the id must appear there as well
    test(
      [[shared], shared, shared],
      `[[#${sharedId}], #${sharedId} {b: 1}, #${sharedId}]`,
      { maxDepth: 2 },
    )

    test([item, item], `[Item#${itemId}, Item#${itemId}]`, {
      dontExpandClassInstances: true,
    })
  })

  it('showArrayIndex', () => {
    test(['a', 'b'], '[0: "a", 1: "b"]', { showArrayIndex: true })
  })

  it('dontExpandClassInstances', () => {
    class Item {
      value = 1
    }
    const options = { dontExpandClassInstances: true }
    test(new Item(), 'Item', options)
    test([new Item()], '[Item]', options)
    test({ constructor: 'x' }, '{constructor: "x"}', options)
    test(Object.create(Object.create(null)), 'Object', options)
  })

  it('dontExpandFunctions', () => {
    const options = { dontExpandFunctions: true }
    test(function func() {}, 'function func', options)
    test(() => {}, 'function anonymous', options)
    test({ f: function func() {} }, '{f: function func}', options)
  })

  it('customToString', () => {
    test({ a: new Date(0), b: 1 }, '{a: DATE, b: 1}', {
      customToString: obj => (obj instanceof Date ? 'DATE' : null),
    })

    class Box {
      value: unknown
      constructor(value: unknown) {
        this.value = value
      }
    }
    const options: FormatAnyOptions = {
      customToString: (obj, path, toString) =>
        obj instanceof Box ? `Box(${toString(obj.value)})` : null,
    }
    test(new Box('x'), 'Box(x)', options)
    test({ a: new Box({ b: 'x' }) }, '{a: Box({b: "x"})}', options)
    test(1, '1', options)
    test('x', 'x', options)
  })

  it('special objects', () => {
    test(/a/g, '/a/g')
    test(new Date(NaN), 'Invalid Date')
    test(new Uint8Array(2), 'Uint8Array[2]')
    test(new ArrayBuffer(3), 'ArrayBuffer[3]')
    test(
      {
        get a() {
          throw new Error('fail')
        },
      },
      '{a: "Error: fail"}',
    )
    test(
      {
        get a() {
          throw 'fail'
        },
      },
      '{a: "Error: fail"}',
    )
  })

  it('errors', () => {
    const error = new Error('msg')
    error.stack = 'Error: msg\n    at a\n    at b'
    test(error, 'Error: msg\n    at a\n    at b')
    test({ e: error }, '{\n  e: Error: msg\n      at a\n      at b\n}', {
      pretty: true,
    })
    test(new Error('abcdef'), 'Error: a', { maxStringLength: 8 })

    const errorNoStack = new Error('msg')
    errorNoStack.stack = ''
    test(errorNoStack, 'Error: msg')

    const errorFramesOnly = new Error('msg')
    errorFramesOnly.stack = '@http://a:1:1\n@http://b:2:2'
    test(errorFramesOnly, 'Error: msg\n@http://a:1:1\n@http://b:2:2')
  })

  describe('error properties', () => {
    type ErrorWithProps = Error & { code?: number; data?: unknown }

    function createError(
      message: string,
      options?: ErrorOptions,
    ): ErrorWithProps {
      const error = new Error(message, options)
      error.stack = `Error: ${message}`
      return error
    }

    it('custom properties', () => {
      const error = createError('msg')
      error.code = 5
      error.data = { a: 'x' }
      test(error, 'Error: msg {code: 5, data: {a: "x"}}')
      test(error, 'Error: msg {\n  code: 5,\n  data: {\n    a: "x"\n  }\n}', {
        pretty: true,
      })
      test(error, 'Error: msg {code: 5, ...}', { maxItems: 1 })
      test(error, 'Error: msg {...}', { maxItems: 0 })
      test(error, 'Error: msg {code: 5}', {
        filter: path => path[0] !== 'data',
      })
    })

    it('without expanding', () => {
      const error = createError('msg')
      error.code = 5
      test(error, 'Error: msg', { maxDepth: 0 })
      test({ e: error }, '{e: Error: msg}', { maxDepth: 1 })
      test(error, 'Error: msg', { dontExpandClassInstances: true })
    })

    it('what the text shows is not repeated', () => {
      const error = createError('msg')
      error.name = 'Custom'
      error.stack = 'Custom: msg'
      test(error, 'Custom: msg')
    })

    it('cause and errors', () => {
      const cause = createError('inner')
      test(
        createError('outer', { cause }),
        'Error: outer {cause: Error: inner}',
      )
      test(
        createError('outer', { cause: createError('middle', { cause }) }),
        'Error: outer {cause: Error: middle {cause: Error: inner}}',
      )
      test(
        createError('outer', { cause: 'text' }),
        'Error: outer {cause: "text"}',
      )

      const errorCauseAssigned = createError('outer')
      errorCauseAssigned.cause = 1
      test(errorCauseAssigned, 'Error: outer {cause: 1}')

      const aggregate = new AggregateError([cause], 'many')
      aggregate.stack = 'AggregateError: many'
      test(aggregate, 'AggregateError: many {errors: [Error: inner]}')
    })

    it('references', () => {
      const error = createError('self')
      error.cause = error
      const id = getObjectId(error)
      test(error, `Error#${id} Error: self {cause: Error#${id}}`)

      const shared = createError('shared')
      const sharedId = getObjectId(shared)
      test(
        { x: shared, y: shared },
        `{x: Error#${sharedId} Error: shared, y: Error#${sharedId}}`,
      )
    })
  })

  it('negative year does not throw', () => {
    test(new Date('-000001-06-15T00:00:00.000Z'), '-000001-06-15T00:00:00.000Z')
    test(
      [new Date('-000001-06-15T00:00:00.000Z')],
      '[-000001-06-15T00:00:00.000Z]',
    )
  })
})
