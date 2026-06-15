import { Priority, priorityCompare, priorityCreate } from './Priority'
import { createTestVariants } from '@flemist/test-variants'

describe('priority > Priority', function () {
  this.timeout(120000)

  function orderToString(order: number) {
    return order == null ? '50' : (order + 50).toString(10).padStart(2, '0')
  }

  function createTestPriorityStr(
    index: number,
    order1: number,
    order2: number,
    order3: number,
    order4: number,
  ) {
    let result: string
    let str = orderToString(index >= 1 ? order1 : null)
    str += '-' + orderToString(index >= 2 ? order2 : null)
    str += '-' + orderToString(index >= 3 ? order3 : null)
    str += '-' + orderToString(index >= 4 ? order4 : null)
    return str
  }

  function createTestPriority(
    index: number,
    order1: number,
    order2: number,
    order3: number,
    order4: number,
  ) {
    let result: Priority
    let priority: Priority
    if (order1 != null) {
      priority = priorityCreate(order1)
      if (index >= 1) {
        result = priority
      }
    }
    if (order2 != null) {
      priority = priorityCreate(order2, priority)
      if (index >= 2) {
        result = priority
      }
    }
    if (order3 != null) {
      priority = priorityCreate(order3, priority)
      if (index >= 3) {
        result = priority
      }
    }
    if (order4 != null) {
      priority = priorityCreate(order4, priority)
      if (index >= 4) {
        result = priority
      }
    }

    return result
  }

  const testVariants = createTestVariants(
    ({
      index1,
      order1_1,
      order1_2,
      order1_3,
      order1_4,

      index2,
      order2_1,
      order2_2,
      order2_3,
      order2_4,
    }: {
      index1: number
      order1_1: number
      order1_2: number
      order1_3: number
      order1_4: number

      index2: number
      order2_1: number
      order2_2: number
      order2_3: number
      order2_4: number
    }) => {
      const priority1Str = createTestPriorityStr(
        index1,
        order1_1,
        order1_2,
        order1_3,
        order1_4,
      )
      const priority2Str = createTestPriorityStr(
        index2,
        order2_1,
        order2_2,
        order2_3,
        order2_4,
      )

      const priority1 = createTestPriority(
        index1,
        order1_1,
        order1_2,
        order1_3,
        order1_4,
      )
      const priority2 = createTestPriority(
        index2,
        order2_1,
        order2_2,
        order2_3,
        order2_4,
      )

      const expected =
        priority1Str === priority2Str ? 0 : priority1Str > priority2Str ? 1 : -1
      const actual = priorityCompare(priority1, priority2)

      assert.strictEqual(actual, expected, priority1Str + ', ' + priority2Str)
    },
  )

  it('variants', async function () {
    await testVariants({
      index1: [4, 3, 2, 1],
      order1_1: [null, 0, 1, -1],
      order1_2: ({ order1_1 }) =>
        order1_1 == null ? [null] : [null, 0, 1, -1],
      order1_3: ({ order1_2 }) =>
        order1_2 == null ? [null] : [null, 0, 1, -1],
      order1_4: ({ order1_3 }) =>
        order1_3 == null ? [null] : [null, 0, 1, -1],

      index2: [4, 3, 2, 1],
      order2_1: [null, 0, 1, -1],
      order2_2: ({ order2_1 }) =>
        order2_1 == null ? [null] : [null, 0, 1, -1],
      order2_3: ({ order2_2 }) =>
        order2_2 == null ? [null] : [null, 0, 1, -1],
      order2_4: ({ order2_3 }) =>
        order2_3 == null ? [null] : [null, 0, 1, -1],
    })()
  })
})
