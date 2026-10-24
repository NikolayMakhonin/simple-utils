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
  })

  it('filter', () => {
    const filter = (path: string[], value: unknown) => value !== 2
    test([1, 2, 3], '[1, 3]', { filter })
    test({ a: 1, b: 2 }, '{a: 1}', { filter })
    test([1, 3, 2], '[1, 3]', { filter, maxItems: 2 })
    test([1, 2, 3, 4], '[1, 3, ...]', { filter, maxItems: 2 })
    test({ a: { b: 1 } }, '{a: {}}', { filter: path => path.length < 2 })
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
  })

  it('references', () => {
    const obj: Record<string, unknown> = { a: 1 }
    obj.self = obj
    test(obj, `{a: 1, self: #${getObjectId(obj)}}`)

    const arr: unknown[] = [1]
    arr.push(arr)
    test(arr, `[1, Array#${getObjectId(arr)}]`)

    const shared = { b: 1 }
    test({ x: shared, y: shared }, `{x: {b: 1}, y: #${getObjectId(shared)}}`)

    const objNullPrototype = Object.create(null)
    objNullPrototype.a = 'x'
    objNullPrototype.self = objNullPrototype
    test(objNullPrototype, `{a: "x", self: #${getObjectId(objNullPrototype)}}`)

    const nested = Object.create(null)
    nested.child = Object.create(null)
    nested.child.value = 1
    test(nested, '{child: Object}', { maxDepth: 1 })
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
})
