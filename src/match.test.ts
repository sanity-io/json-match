import {describe, test, expect, vi} from 'vitest'
import {parse} from './parse'
import {jsonMatch} from './match'
import {getIndexForKey} from './path'

vi.mock('./path', async (importOriginal) => {
  const {getIndexForKey, ...rest} = await importOriginal<typeof import('./path')>()
  return {
    ...rest,
    getIndexForKey: vi.fn(getIndexForKey),
  }
})

describe('Match Function', () => {
  type User = {name: string; age: number; email?: string; role?: string}
  const alice: User = {name: 'Alice', age: 25, email: 'alice@example.com', role: 'user'}
  const bob: User = {name: 'Bob', age: 30, email: 'bob@example.com', role: 'admin'}
  const carol: User = {name: 'Carol', age: 35, email: 'carol@example.com', role: 'admin'}
  const jules: User = {name: 'Jules', age: 44, role: 'user'}

  const testData = {
    users: [alice, bob, carol, jules],
    config: {
      maxUsers: 100,
      version: '1.0.0',
    },
    bicycle: {
      color: 'red',
      type: 'road',
    },
  }

  const keyedData = {
    items: [
      {_key: 'item1', name: 'First', price: 100},
      {_key: 'item2', name: 'Second', price: 200},
      {_key: 'item3', name: 'Third', price: 300},
    ],
  }

  describe('Basic Path Expressions', () => {
    test('matches simple identifier', () => {
      const results = Array.from(jsonMatch(testData, parse('users')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toBe(testData.users)
      expect(path).toEqual(['users'])
    })

    test('matches dot access', () => {
      const results = Array.from(jsonMatch(testData, parse('config.version')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toBe('1.0.0')
      expect(path).toEqual(['config', 'version'])
    })

    test('matches nested dot access', () => {
      const results = Array.from(jsonMatch(testData, parse('bicycle.color')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toBe('red')
      expect(path).toEqual(['bicycle', 'color'])
    })
  })

  describe('Implicit This Access', () => {
    test('matches implicit this with dot', () => {
      const results = Array.from(jsonMatch(testData, parse('.bicycle')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toBe(testData.bicycle)
      expect(path).toEqual(['bicycle'])
    })

    test('matches implicit this with nested path', () => {
      const results = Array.from(jsonMatch(testData, parse('.bicycle.color')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toBe('red')
      expect(path).toEqual(['bicycle', 'color'])
    })

    test('matches bare recursive descent', () => {
      const results = Array.from(jsonMatch(testData, parse('..')))
      expect(results).toHaveLength(26)
      expect(results).toEqual([
        {path: ['users'], value: testData.users},
        {path: ['config'], value: testData.config},
        {path: ['bicycle'], value: testData.bicycle},
        {path: ['users', 0], value: testData.users[0]},
        {path: ['users', 1], value: testData.users[1]},
        {path: ['users', 2], value: testData.users[2]},
        {path: ['users', 3], value: testData.users[3]},
        {path: ['users', 0, 'name'], value: testData.users[0].name},
        {path: ['users', 0, 'age'], value: testData.users[0].age},
        {path: ['users', 0, 'email'], value: testData.users[0].email},
        {path: ['users', 0, 'role'], value: testData.users[0].role},
        {path: ['users', 1, 'name'], value: testData.users[1].name},
        {path: ['users', 1, 'age'], value: testData.users[1].age},
        {path: ['users', 1, 'email'], value: testData.users[1].email},
        {path: ['users', 1, 'role'], value: testData.users[1].role},
        {path: ['users', 2, 'name'], value: testData.users[2].name},
        {path: ['users', 2, 'age'], value: testData.users[2].age},
        {path: ['users', 2, 'email'], value: testData.users[2].email},
        {path: ['users', 2, 'role'], value: testData.users[2].role},
        {path: ['users', 3, 'name'], value: testData.users[3].name},
        {path: ['users', 3, 'age'], value: testData.users[3].age},
        {path: ['users', 3, 'role'], value: testData.users[3].role},
        {path: ['config', 'maxUsers'], value: testData.config.maxUsers},
        {path: ['config', 'version'], value: testData.config.version},
        {path: ['bicycle', 'color'], value: testData.bicycle.color},
        {path: ['bicycle', 'type'], value: testData.bicycle.type},
      ])
    })
  })

  describe('Array Access', () => {
    test('matches array index', () => {
      const results = Array.from(jsonMatch(testData, parse('users[0]')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(path).toEqual(['users', 0])
      expect(value).toBe(alice)
    })

    test('matches negative array index', () => {
      const results = Array.from(jsonMatch(testData, parse('users[-1]')))
      expect(results).toHaveLength(1)
      const [{value, path}] = results
      expect(path).toEqual(['users', -1])
      expect(value).toEqual(jules)
    })

    test('matches array slice', () => {
      const results = Array.from(jsonMatch(testData, parse('users[1:3]')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.path).toEqual(['users', 1])
      expect(first.value).toBe(bob)
      expect(second.path).toEqual(['users', 2])
      expect(second.value).toBe(carol)
      expect(testData.users.slice(1, 3)).toEqual(results.map((i) => i.value))
    })

    test('matches array slice with start only', () => {
      const results = Array.from(jsonMatch(testData, parse('users[1:]')))
      expect(results).toHaveLength(3)
      const [first, second, third] = results
      expect(first.path).toEqual(['users', 1])
      expect(second.path).toEqual(['users', 2])
      expect(third.path).toEqual(['users', 3])
      expect(testData.users.slice(1, undefined)).toEqual(results.map((i) => i.value))
    })

    test('matches array slice with end only', () => {
      const results = Array.from(jsonMatch(testData, parse('users[:2]')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.path).toEqual(['users', 0])
      expect(second.path).toEqual(['users', 1])
      expect(testData.users.slice(undefined, 2)).toEqual(results.map((i) => i.value))
    })

    test('matches negative slice with both start and end', () => {
      const results = Array.from(jsonMatch(testData, parse('users[-3:-1]')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.path).toEqual(['users', 1])
      expect(first.value).toEqual(testData.users[1])
      expect(second.path).toEqual(['users', 2])
      expect(second.value).toEqual(testData.users[2])
      expect(testData.users.slice(-3, -1)).toEqual(results.map((i) => i.value))
    })

    test('matches negative slice with start only', () => {
      const results = Array.from(jsonMatch(testData, parse('users[-2:]')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.path).toEqual(['users', 2])
      expect(first.value).toEqual(testData.users[2])
      expect(second.path).toEqual(['users', 3])
      expect(second.value).toEqual(testData.users[3])
      expect(testData.users.slice(-2, undefined)).toEqual(results.map((i) => i.value))
    })

    test('matches negative slice with end only', () => {
      const results = Array.from(jsonMatch(testData, parse('users[:-2]')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.path).toEqual(['users', 0])
      expect(first.value).toEqual(testData.users[0])
      expect(second.path).toEqual(['users', 1])
      expect(second.value).toEqual(testData.users[1])
      expect(testData.users.slice(undefined, -2)).toEqual(results.map((i) => i.value))
    })

    test('matches mixed positive and negative slice indices', () => {
      const results = Array.from(jsonMatch(testData, parse('users[1:-1]')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.path).toEqual(['users', 1])
      expect(first.value).toEqual(testData.users[1])
      expect(second.path).toEqual(['users', 2])
      expect(second.value).toEqual(testData.users[2])
      expect(testData.users.slice(1, -1)).toEqual(results.map((i) => i.value))
    })

    test('matches negative slice from end to positive index', () => {
      const results = Array.from(jsonMatch(testData, parse('users[-3:2]')))
      expect(results).toHaveLength(1)
      const [first] = results
      expect(first.path).toEqual(['users', 1])
      expect(first.value).toEqual(testData.users[1])
      expect(testData.users.slice(-3, 2)).toEqual(results.map((i) => i.value))
    })

    test('matches negative slice that exceeds array bounds', () => {
      const results = Array.from(jsonMatch(testData, parse('users[-10:-8]')))
      expect(results).toHaveLength(0) // Should return empty for out-of-bounds indices
      expect(testData.users.slice(-10, -8)).toEqual(results.map((i) => i.value))
    })

    test('matches negative slice with equal start and end indices', () => {
      const results = Array.from(jsonMatch(testData, parse('users[-2:-2]')))
      expect(results).toHaveLength(0) // Should return empty for equal indices
      expect(testData.users.slice(-2, -2)).toEqual(results.map((i) => i.value))
    })

    test('matches negative slice where start is greater than end', () => {
      const results = Array.from(jsonMatch(testData, parse('users[-1:-3]')))
      expect(results).toHaveLength(0) // Should return empty when start > end
      expect(testData.users.slice(-1, -3)).toEqual(results.map((i) => i.value))
    })
  })

  describe('Wildcards', () => {
    test('matches wildcard on object', () => {
      const results = Array.from(jsonMatch(testData, parse('bicycle.*')))
      expect(results).toHaveLength(2)
      const first = results[0]
      const second = results[1]
      expect(first.path).toEqual(['bicycle', 'color'])
      expect(second.path).toEqual(['bicycle', 'type'])
      expect(first.value).toEqual('red')
      expect(second.value).toEqual('road')
    })

    test('matches wildcard on array', () => {
      const results = Array.from(jsonMatch(testData, parse('users[*]')))
      expect(results).toHaveLength(4)
      const [first, second, third, fourth] = results
      expect(first.path).toEqual(['users', 0])
      expect(second.path).toEqual(['users', 1])
      expect(third.path).toEqual(['users', 2])
      expect(fourth.path).toEqual(['users', 3])
    })

    test('matches wildcard with property access', () => {
      const results = Array.from(jsonMatch(testData, parse('users[*].name')))
      expect(results).toHaveLength(4)
      const [first, second, third, fourth] = results
      expect(first.value).toEqual('Alice')
      expect(first.path).toEqual(['users', 0, 'name'])
      expect(second.value).toEqual('Bob')
      expect(second.path).toEqual(['users', 1, 'name'])
      expect(third.value).toEqual('Carol')
      expect(third.path).toEqual(['users', 2, 'name'])
      expect(fourth.value).toEqual('Jules')
      expect(fourth.path).toEqual(['users', 3, 'name'])
    })
  })

  describe('Boolean Literals', () => {
    test('matches items with boolean comparison (true)', () => {
      const data = {
        items: [
          {id: 1, active: true},
          {id: 2, active: false},
          {id: 3, active: true},
        ],
      }
      const results = Array.from(jsonMatch(data, parse('items[active == true]')))
      expect(results).toHaveLength(2)
      expect(results[0].value).toBe(data.items[0])
      expect(results[0].path).toEqual(['items', 0])
      expect(results[1].value).toBe(data.items[2])
      expect(results[1].path).toEqual(['items', 2])
    })

    test('matches items with boolean comparison (false)', () => {
      const data = {
        items: [
          {id: 1, active: true},
          {id: 2, active: false},
          {id: 3, active: true},
        ],
      }
      const results = Array.from(jsonMatch(data, parse('items[active == false]')))
      expect(results).toHaveLength(1)
      expect(results[0].value).toBe(data.items[1])
      expect(results[0].path).toEqual(['items', 1])
    })

    test('matches items with boolean inequality', () => {
      const data = {
        items: [
          {id: 1, visible: true},
          {id: 2, visible: false},
          {id: 3, visible: true},
        ],
      }
      const results = Array.from(jsonMatch(data, parse('items[visible != false]')))
      expect(results).toHaveLength(2)
      expect(results[0].value).toEqual({id: 1, visible: true})
      expect(results[1].value).toEqual({id: 3, visible: true})
    })

    test('handles boolean literals in arrays', () => {
      const data = {values: [true, false, true, false]}
      const results = Array.from(jsonMatch(data, parse('values[@ == true]')))
      expect(results).toHaveLength(2)
      expect(results[0].value).toBe(true)
      expect(results[0].path).toEqual(['values', 0])
      expect(results[1].value).toBe(true)
      expect(results[1].path).toEqual(['values', 2])
    })
  })

  describe('Constraints', () => {
    test('matches comparison constraint', () => {
      const results = Array.from(jsonMatch(testData, parse('users[age > 28]')))
      expect(results).toHaveLength(3)
      const [first, second, third] = results
      expect(first.value).toEqual({
        name: 'Bob',
        age: 30,
        email: 'bob@example.com',
        role: 'admin',
      })
      expect(first.path).toEqual(['users', 1])
      expect(second.value).toEqual({
        name: 'Carol',
        age: 35,
        email: 'carol@example.com',
        role: 'admin',
      })
      expect(second.path).toEqual(['users', 2])
      expect(third.value).toEqual({
        name: 'Jules',
        age: 44,
        role: 'user',
      })
      expect(third.path).toEqual(['users', 3])
    })

    test('matches equality constraint', () => {
      const results = Array.from(jsonMatch(testData, parse('users[name == "Alice"]')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toEqual({
        name: 'Alice',
        age: 25,
        email: 'alice@example.com',
        role: 'user',
      })
      expect(path).toEqual(['users', 0])
    })

    test('matches constraint with property access', () => {
      const results = Array.from(jsonMatch(testData, parse('users[age > 28].name')))
      expect(results).toHaveLength(3)
      const [first, second, third] = results
      expect(first.value).toEqual('Bob')
      expect(first.path).toEqual(['users', 1, 'name'])
      expect(second.value).toEqual('Carol')
      expect(second.path).toEqual(['users', 2, 'name'])
      expect(third.value).toEqual('Jules')
      expect(third.path).toEqual(['users', 3, 'name'])
    })

    test('matches existence constraint', () => {
      const results = Array.from(jsonMatch(testData, parse('users[email?]')))
      expect(results).toHaveLength(3) // Alice, Bob, and Carol have email (Jules doesn't have email)
      const [first, second, third] = results
      expect(first.path).toEqual(['users', 0])
      expect(second.path).toEqual(['users', 1])
      expect(third.path).toEqual(['users', 2])
    })

    test('matches multiple constraints (OR logic)', () => {
      const results = Array.from(
        jsonMatch(testData, parse('users[age > 32, name == "Alice"].name')),
      )
      expect(results).toHaveLength(3) // Carol (age > 32), Jules (age > 32), and Alice (name == "Alice")
      const [first, second, third] = results
      expect(first.value).toEqual('Carol')
      expect(first.path).toEqual(['users', 2, 'name'])
      expect(second.value).toEqual('Jules')
      expect(second.path).toEqual(['users', 3, 'name'])
      expect(third.value).toEqual('Alice')
      expect(third.path).toEqual(['users', 0, 'name'])
    })

    test('matches multiple chained constraints (AND logic)', () => {
      const results = Array.from(
        jsonMatch(testData, parse('users[role == "admin"][age > 32].name')),
      )
      expect(results).toHaveLength(1) // Carol (age > 32) (role == "admin")
      const [first] = results
      expect(first.value).toEqual('Carol')
      expect(first.path).toEqual(['users', 2, 'name'])
    })

    test('matches inequality constraint (!=)', () => {
      const results = Array.from(jsonMatch(testData, parse('users[role != "admin"]')))
      expect(results).toHaveLength(2) // Alice and Jules are not admin
      const [first, second] = results
      expect(first.path).toEqual(['users', 0])
      expect(first.value).toBe(alice)
      expect(second.path).toEqual(['users', 3])
      expect(second.value).toBe(jules)
    })

    test('matches less than or equal constraint (<=)', () => {
      const results = Array.from(jsonMatch(testData, parse('users[age <= 30]')))
      expect(results).toHaveLength(2) // Alice (25) and Bob (30)
      const [first, second] = results
      expect(first.path).toEqual(['users', 0])
      expect(first.value).toBe(alice)
      expect(second.path).toEqual(['users', 1])
      expect(second.value).toBe(bob)
    })

    test('matches greater than or equal constraint (>=)', () => {
      const results = Array.from(jsonMatch(testData, parse('users[age >= 35]')))
      expect(results).toHaveLength(2) // Carol (35) and Jules (44)
      const [first, second] = results
      expect(first.path).toEqual(['users', 2])
      expect(first.value).toBe(carol)
      expect(second.path).toEqual(['users', 3])
      expect(second.value).toBe(jules)
    })

    test('matches less than constraint (<)', () => {
      const results = Array.from(jsonMatch(testData, parse('users[age < 30]')))
      expect(results).toHaveLength(1) // Only Alice (25)
      const [first] = results
      expect(first.path).toEqual(['users', 0])
      expect(first.value).toBe(alice)
    })

    test('handles comparison with non-numeric values', () => {
      const results = Array.from(jsonMatch(testData, parse('users[name > "Bob"]')))
      expect(results).toHaveLength(0) // String comparisons should not work for >, <, <=, >=
    })

    test('handles comparison where left expression evaluates to nothing', () => {
      const results = Array.from(jsonMatch(testData, parse('users[nonexistent == "test"]')))
      expect(results).toHaveLength(0) // Should return empty when left side doesn't exist
    })

    test('handles comparison where right expression evaluates to nothing', () => {
      const results = Array.from(jsonMatch(testData, parse('users[name == nonexistent]')))
      expect(results).toHaveLength(0) // Should return empty when right side doesn't exist
    })

    test('handles object-level comparison (not on array)', () => {
      const objectData = {
        user: {name: 'Alice', age: 25},
        settings: {theme: 'dark'},
      }
      const results = Array.from(jsonMatch(objectData, parse('user[age == 25]')))
      expect(results).toHaveLength(1)
      const [first] = results
      expect(first.value).toEqual({name: 'Alice', age: 25})
      expect(first.path).toEqual(['user'])
    })

    test('handles object-level comparison with inequality', () => {
      const objectData = {
        user: {name: 'Alice', age: 25},
      }
      const results = Array.from(jsonMatch(objectData, parse('user[age != 30]')))
      expect(results).toHaveLength(1)
      const [first] = results
      expect(first.value).toEqual({name: 'Alice', age: 25})
      expect(first.path).toEqual(['user'])
    })
  })

  describe('Keyed Objects', () => {
    test('uses _key for keyed array items', () => {
      const results = Array.from(jsonMatch(keyedData, parse('items[0]')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toEqual({
        _key: 'item1',
        name: 'First',
        price: 100,
      })
      expect(path).toEqual(['items', {_key: 'item1'}])
    })

    test('uses _key for keyed items in wildcard', () => {
      const results = Array.from(jsonMatch(keyedData, parse('items[*]')))
      expect(results).toHaveLength(3)
      const [first, second, third] = results
      expect(first.path).toEqual(['items', {_key: 'item1'}])
      expect(second.path).toEqual(['items', {_key: 'item2'}])
      expect(third.path).toEqual(['items', {_key: 'item3'}])
    })

    test('uses _key for keyed items in constraint', () => {
      const results = Array.from(jsonMatch(keyedData, parse('items[price > 150]')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.path).toEqual(['items', {_key: 'item2'}])
      expect(second.path).toEqual(['items', {_key: 'item3'}])
    })

    test('has special speed up for keyed constraints', () => {
      vi.mocked(getIndexForKey).mockClear()
      expect(getIndexForKey).not.toHaveBeenCalled()
      const results = Array.from(jsonMatch(keyedData, parse('items[_key == "item2"]')))
      expect(results).toHaveLength(1)
      const [first] = results
      expect(first.path).toEqual(['items', {_key: 'item2'}])
      expect(getIndexForKey).toHaveBeenCalledTimes(1)
    })

    test('has special speed up for keyed constraints (string literal first)', () => {
      vi.mocked(getIndexForKey).mockClear()
      expect(getIndexForKey).not.toHaveBeenCalled()
      const results = Array.from(jsonMatch(keyedData, parse('items["item2" == _key]')))
      expect(results).toHaveLength(1)
      const [first] = results
      expect(first.path).toEqual(['items', {_key: 'item2'}])
      expect(getIndexForKey).toHaveBeenCalledTimes(1)
    })
  })

  describe('Expression Unions', () => {
    test('matches simple union', () => {
      const results = Array.from(jsonMatch(testData, parse('[users, config]')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.path).toEqual(['users'])
      expect(first.value).toBe(testData.users)
      expect(second.path).toEqual(['config'])
      expect(second.value).toBe(testData.config)
    })

    test('matches union with property access', () => {
      const results = Array.from(jsonMatch(testData, parse('[bicycle.color, config.version]')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.value).toEqual('red')
      expect(first.path).toEqual(['bicycle', 'color'])
      expect(second.value).toEqual('1.0.0')
      expect(second.path).toEqual(['config', 'version'])
    })
  })

  describe('Complex Expressions', () => {
    test('matches complex nested expression', () => {
      const complexData = {
        data: {
          items: [
            {tags: ['red', 'blue'], price: 100},
            {tags: ['green'], price: 200},
          ],
        },
      }

      const results = Array.from(jsonMatch(complexData, parse('data.items[*].tags[0]')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.value).toEqual('red')
      expect(first.path).toEqual(['data', 'items', 0, 'tags', 0])
      expect(second.value).toEqual('green')
      expect(second.path).toEqual(['data', 'items', 1, 'tags', 0])
    })

    test('matches path with multiple subscripts', () => {
      const matrixData = {
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      }

      const results = Array.from(jsonMatch(matrixData, parse('matrix[1][2]')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toBe(6)
      expect(path).toEqual(['matrix', 1, 2])
    })
  })

  describe('Edge Cases', () => {
    test('yields `undefined` value if the value is an object and the path is non-existent', () => {
      const results = Array.from(jsonMatch(testData, parse('nonexistent')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toBe(undefined)
      expect(path).toEqual(['nonexistent'])
    })

    test('yields `undefined` value for non-existent array access', () => {
      const results = Array.from(jsonMatch(testData, parse('users[999]')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toBe(undefined)
      expect(path).toEqual(['users', 999])
    })

    test('yields `undefined` for key constraints on existing arrays', () => {
      const results = Array.from(jsonMatch(keyedData, parse('items[_key == "item4"]')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toBe(undefined)
      expect(path).toEqual(['items', {_key: 'item4'}])
    })

    test('returns empty for constraints on non-arrays', () => {
      const results = Array.from(jsonMatch(testData, parse('config[name == "test"]')))
      expect(results).toHaveLength(0)
    })

    test('handles empty data', () => {
      const results = Array.from(jsonMatch({}, parse('anything')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toBe(undefined)
      expect(path).toEqual(['anything'])
    })

    test('handles null values', () => {
      const results = Array.from(jsonMatch({value: null}, parse('value')))
      expect(results).toHaveLength(1)
      const {value} = results[0]
      expect(value).toBe(null)
    })

    test('handles string literals', () => {
      const results = Array.from(jsonMatch(testData, parse('["some", "literals", ["here"]]')))
      expect(results).toHaveLength(0)
    })

    test('handles boolean literals', () => {
      const results = Array.from(jsonMatch(testData, parse('[true, false]')))
      expect(results).toHaveLength(0)
    })

    test('dedupes matches from multiple candidates', () => {
      const results = Array.from(jsonMatch(testData, 'users[email?, age > 5]'))
      expect(results).toHaveLength(4)
      expect(results).toEqual([
        {path: ['users', 0], value: testData.users[0]},
        {path: ['users', 1], value: testData.users[1]},
        {path: ['users', 2], value: testData.users[2]},
        {path: ['users', 3], value: testData.users[3]},
      ])
    })

    test('returns nested undefined matches when trying to match identifier on array', () => {
      const results = Array.from(jsonMatch(testData, parse('users.someProperty')))
      expect(results).toHaveLength(4)
      expect(results).toEqual([
        {path: ['users', 0, 'someProperty'], value: undefined},
        {path: ['users', 1, 'someProperty'], value: undefined},
        {path: ['users', 2, 'someProperty'], value: undefined},
        {path: ['users', 3, 'someProperty'], value: undefined},
      ])
    })

    test('returns empty when trying to slice on non-array', () => {
      const results = Array.from(jsonMatch(testData, parse('config[1:3]')))
      expect(results).toHaveLength(0) // Cannot slice an object
    })

    test('yields undefined when trying to index on non-array/object', () => {
      const results = Array.from(jsonMatch(testData, parse('config.version[0]')))
      expect(results).toHaveLength(1)
      const {value, path} = results[0]
      expect(value).toBe(undefined)
      expect(path).toEqual(['config', 'version', 0])
    })

    test('handles null literal as a standalone expression', () => {
      const results = Array.from(jsonMatch({value: null}, parse('null')))
      // Should not match any path, only yield the literal value with LITERAL_PATH (which is skipped)
      expect(results).toHaveLength(0)
    })

    test('handles null in union expression', () => {
      const results = Array.from(jsonMatch({value: null}, parse('[null, true, false]')))
      // Should not match any path, only yield the literal values with LITERAL_PATH (which is skipped)
      expect(results).toHaveLength(0)
    })

    test('handles null in comparison constraint', () => {
      const data = {
        items: [{value: null}, {value: 1}, {value: null}],
      }
      const results = Array.from(jsonMatch(data, parse('items[value == null]')))
      expect(results).toHaveLength(2)
      expect(results[0].value).toBe(data.items[0])
      expect(results[0].path).toEqual(['items', 0])
      expect(results[1].value).toBe(data.items[2])
      expect(results[1].path).toEqual(['items', 2])
    })

    test('handles null as a property value in comparison', () => {
      const data = {
        items: [{property: null}, {property: 'not-null'}, {property: null}],
      }
      const results = Array.from(jsonMatch(data, parse('items[property == null]')))
      expect(results).toHaveLength(2)
      expect(results[0].value).toBe(data.items[0])
      expect(results[0].path).toEqual(['items', 0])
      expect(results[1].value).toBe(data.items[2])
      expect(results[1].path).toEqual(['items', 2])
    })
  })

  describe('Identifier on Array', () => {
    test('evaluates identifier against array items recursively', () => {
      const arrayData = {
        items: [
          {name: 'Alice', age: 25},
          {name: 'Bob', age: 30},
          {name: 'Carol', age: 35},
        ],
      }

      // When evaluating 'name' against an array, it should apply to each array item
      const results = Array.from(jsonMatch(arrayData, parse('items.name')))
      expect(results).toHaveLength(3)
      const [first, second, third] = results
      expect(first.value).toBe('Alice')
      expect(first.path).toEqual(['items', 0, 'name'])
      expect(second.value).toBe('Bob')
      expect(second.path).toEqual(['items', 1, 'name'])
      expect(third.value).toBe('Carol')
      expect(third.path).toEqual(['items', 2, 'name'])
    })

    test('evaluates identifier against array items with nested properties', () => {
      const nestedData = {
        users: [
          {profile: {firstName: 'Alice', lastName: 'Smith'}},
          {profile: {firstName: 'Bob', lastName: 'Jones'}},
        ],
      }

      const results = Array.from(jsonMatch(nestedData, parse('users.profile.firstName')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.value).toBe('Alice')
      expect(first.path).toEqual(['users', 0, 'profile', 'firstName'])
      expect(second.value).toBe('Bob')
      expect(second.path).toEqual(['users', 1, 'profile', 'firstName'])
    })

    test('evaluates identifier against array items with mixed data types', () => {
      const mixedData = {
        items: [
          {name: 'Alice', active: true},
          {name: 'Bob', active: false},
          {name: 'Carol', active: true},
        ],
      }

      const results = Array.from(jsonMatch(mixedData, parse('items.active')))
      expect(results).toHaveLength(3)
      const [first, second, third] = results
      expect(first.value).toBe(true)
      expect(first.path).toEqual(['items', 0, 'active'])
      expect(second.value).toBe(false)
      expect(second.path).toEqual(['items', 1, 'active'])
      expect(third.value).toBe(true)
      expect(third.path).toEqual(['items', 2, 'active'])
    })

    test('evaluates identifier against array items with optional properties', () => {
      const optionalData = {
        users: [
          {name: 'Alice', email: 'alice@example.com'},
          {name: 'Bob'}, // no email
          {name: 'Carol', email: 'carol@example.com'},
        ],
      }

      const results = Array.from(jsonMatch(optionalData, parse('users.email')))
      // Only Alice and Carol have email but Bob will match with `undefined`
      expect(results).toHaveLength(3)
      const [first, second, third] = results
      expect(first.value).toBe('alice@example.com')
      expect(first.path).toEqual(['users', 0, 'email'])
      expect(second.value).toBe(undefined)
      expect(second.path).toEqual(['users', 1, 'email'])
      expect(third.value).toBe('carol@example.com')
      expect(third.path).toEqual(['users', 2, 'email'])
    })

    test('evaluates identifier against array items with keyed objects', () => {
      const keyedArrayData = {
        items: [
          {_key: 'item1', name: 'First', price: 100},
          {_key: 'item2', name: 'Second', price: 200},
        ],
      }

      const results = Array.from(jsonMatch(keyedArrayData, parse('items.name')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.value).toBe('First')
      expect(first.path).toEqual(['items', {_key: 'item1'}, 'name'])
      expect(second.value).toBe('Second')
      expect(second.path).toEqual(['items', {_key: 'item2'}, 'name'])
    })

    test('evaluates identifier against empty array', () => {
      const emptyArrayData = {
        items: [],
      }

      const results = Array.from(jsonMatch(emptyArrayData, parse('items.name')))
      expect(results).toHaveLength(0)
    })

    test('evaluates identifier against array with mixed primitive and object items', () => {
      const mixedArrayData = {
        items: ['string1', {name: 'Alice', age: 25}, 'string2', {name: 'Bob', age: 30}],
      }

      // Should match all items: undefined for strings, actual values for objects
      const results = Array.from(jsonMatch(mixedArrayData, parse('items.name')))
      expect(results).toHaveLength(4)
      const [first, second, third, fourth] = results
      expect(first.value).toBe(undefined)
      expect(first.path).toEqual(['items', 0, 'name'])
      expect(second.value).toBe('Alice')
      expect(second.path).toEqual(['items', 1, 'name'])
      expect(third.value).toBe(undefined)
      expect(third.path).toEqual(['items', 2, 'name'])
      expect(fourth.value).toBe('Bob')
      expect(fourth.path).toEqual(['items', 3, 'name'])
    })

    test('evaluates identifier against array with null and undefined items', () => {
      const nullArrayData = {
        items: [{name: 'Alice'}, null, {name: 'Bob'}, undefined, {name: 'Carol'}],
      }

      const results = Array.from(jsonMatch(nullArrayData, parse('items.name')))
      expect(results).toHaveLength(5) // All items: objects with values and null/undefined with undefined
      const [first, second, third, fourth, fifth] = results
      expect(first.value).toBe('Alice')
      expect(first.path).toEqual(['items', 0, 'name'])
      expect(second.value).toBe(undefined)
      expect(second.path).toEqual(['items', 1, 'name'])
      expect(third.value).toBe('Bob')
      expect(third.path).toEqual(['items', 2, 'name'])
      expect(fourth.value).toBe(undefined)
      expect(fourth.path).toEqual(['items', 3, 'name'])
      expect(fifth.value).toBe('Carol')
      expect(fifth.path).toEqual(['items', 4, 'name'])
    })

    test('evaluates identifier against array with deeply nested objects', () => {
      const deepData = {
        data: [
          {user: {profile: {personal: {name: 'Alice', age: 25}}}},
          {user: {profile: {personal: {name: 'Bob', age: 30}}}},
        ],
      }

      const results = Array.from(jsonMatch(deepData, parse('data.user.profile.personal.name')))
      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.value).toBe('Alice')
      expect(first.path).toEqual(['data', 0, 'user', 'profile', 'personal', 'name'])
      expect(second.value).toBe('Bob')
      expect(second.path).toEqual(['data', 1, 'user', 'profile', 'personal', 'name'])
    })
  })

  describe('Generator Behavior', () => {
    test('can get first match only', () => {
      const query = parse('users[*].name')
      const generator = jsonMatch(testData, query)
      const first = generator.next()

      expect(first.done).toBe(false)
      const {value, path} = first.value
      expect(value).toBe('Alice')
      expect(path).toEqual(['users', 0, 'name'])
    })

    test('allows early termination', () => {
      const query = parse('users[*].name')
      const generator = jsonMatch(testData, query)

      // Get first two results
      const results = []
      for (const result of generator) {
        results.push(result)
        if (results.length === 2) break
      }

      expect(results).toHaveLength(2)
      const [first, second] = results
      expect(first.value).toEqual('Alice')
      expect(first.path).toEqual(['users', 0, 'name'])
      expect(second.value).toEqual('Bob')
      expect(second.path).toEqual(['users', 1, 'name'])
    })
  })
})
