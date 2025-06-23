import {describe, test, expect} from 'vitest'
import {
  getIndexForKey,
  getParentPath,
  addPathSegment,
  parsePath,
  createPathSet,
  type CompatPath,
  type Path,
} from './path'
import {parse, PathNode} from './parse'
import {stringifyPath} from './stringify'

describe('path utilities', () => {
  describe('getIndexForKey', () => {
    test('returns index for existing key', () => {
      const array = [
        {_key: 'first', name: 'Alice'},
        {_key: 'second', name: 'Bob'},
        {_key: 'third', name: 'Carol'},
      ]

      expect(getIndexForKey(array, 'first')).toBe(0)
      expect(getIndexForKey(array, 'second')).toBe(1)
      expect(getIndexForKey(array, 'third')).toBe(2)
    })

    test('returns undefined for non-existent key', () => {
      const array = [
        {_key: 'first', name: 'Alice'},
        {_key: 'second', name: 'Bob'},
      ]

      expect(getIndexForKey(array, 'nonexistent')).toBeUndefined()
    })

    test('returns undefined for non-array input', () => {
      expect(getIndexForKey(null, 'key')).toBeUndefined()
      expect(getIndexForKey(undefined, 'key')).toBeUndefined()
      expect(getIndexForKey('string', 'key')).toBeUndefined()
      expect(getIndexForKey({_key: 'test'}, 'test')).toBeUndefined()
    })

    test('handles array with items without _key', () => {
      const array = [{name: 'Alice'}, {_key: 'second', name: 'Bob'}, {name: 'Carol'}]

      expect(getIndexForKey(array, 'second')).toBe(1)
      expect(getIndexForKey(array, 'first')).toBeUndefined()
    })

    test('handles array with non-object items', () => {
      const array = ['string', {_key: 'second', name: 'Bob'}, 42, null]

      expect(getIndexForKey(array, 'second')).toBe(1)
      expect(getIndexForKey(array, 'string')).toBeUndefined()
    })

    test('caches results for performance', () => {
      const array = [
        {_key: 'first', name: 'Alice'},
        {_key: 'second', name: 'Bob'},
      ]

      // First call should build cache
      expect(getIndexForKey(array, 'first')).toBe(0)

      // Second call should use cache (we can't easily test this directly,
      // but we can verify it still works)
      expect(getIndexForKey(array, 'first')).toBe(0)
      expect(getIndexForKey(array, 'second')).toBe(1)
    })

    test('handles _key values that are not strings', () => {
      const array = [
        {_key: 123, name: 'Alice'},
        {_key: 'second', name: 'Bob'},
      ]

      expect(getIndexForKey(array, 'second')).toBe(1)
      expect(getIndexForKey(array, '123')).toBeUndefined()
    })

    test('handles empty array', () => {
      expect(getIndexForKey([], 'any')).toBeUndefined()
    })
  })

  describe('getParentPath', () => {
    test('returns parent path for string paths', () => {
      expect(getParentPath('user.profile.email')).toBe('user.profile')
      expect(getParentPath('items[0].name')).toBe('items[0]')
      expect(getParentPath('data[*].tags')).toBe('data[*]')
    })

    test('returns parent path for complex paths', () => {
      expect(getParentPath('users[age > 21].profile.email')).toBe('users[age>21].profile')
      expect(getParentPath('data..items.metadata')).toBe('data..items')
      expect(getParentPath('.user.profile')).toBe('@.user')
    })

    test('returns undefined for root-level paths', () => {
      expect(getParentPath('user')).toBeUndefined()
      expect(getParentPath('*')).toBeUndefined()
      expect(getParentPath('@')).toBeUndefined()
      expect(getParentPath('[0]')).toBeUndefined()
    })

    test('works with studio-style path arrays', () => {
      const path: CompatPath = ['user', 'profile', 'email']
      expect(getParentPath(path)).toBe('user.profile')

      const pathWithIndex: CompatPath = ['items', 0, 'name']
      expect(getParentPath(pathWithIndex)).toBe('items[0]')

      const pathWithSlice: CompatPath = ['items', [1, 3], 'name']
      expect(getParentPath(pathWithSlice)).toBe('items[1:3]')
    })

    test('works with ExprNode directly', () => {
      const ast = parse('user.profile.email')
      expect(getParentPath(ast)).toBe('user.profile')

      const simpleAst = parse('user')
      expect(getParentPath(simpleAst)).toBeUndefined()
    })

    test('handles implicit root access', () => {
      expect(getParentPath('.user.profile')).toBe('@.user')
      expect(getParentPath('..items.name')).toBe('@..items')
    })

    test('returns undefined for non-path expressions', () => {
      expect(getParentPath('42')).toBeUndefined()
      expect(getParentPath('"string"')).toBeUndefined()
    })

    test('handles empty CompatPath', () => {
      expect(() => getParentPath([])).toThrow('Path cannot be empty')
    })
  })

  describe('addPathSegment', () => {
    test('adds string segments to string paths', () => {
      expect(addPathSegment('user', 'profile')).toBe('user.profile')
      expect(addPathSegment('user.profile', 'email')).toBe('user.profile.email')
    })

    test('adds number segments to string paths', () => {
      expect(addPathSegment('items', 0)).toBe('items[0]')
      expect(addPathSegment('items[0]', 1)).toBe('items[0][1]')
      expect(addPathSegment('user.items', 2)).toBe('user.items[2]')
    })

    test('adds keyed object segments to string paths', () => {
      expect(addPathSegment('users', {_key: 'alice'})).toBe('users[_key=="alice"]')
      expect(addPathSegment('data.items', {_key: 'special-key'})).toBe(
        'data.items[_key=="special-key"]',
      )
    })

    test('adds slice segments to string paths', () => {
      expect(addPathSegment('items', [1, 3])).toBe('items[1:3]')
      expect(addPathSegment('items', [1, ''])).toBe('items[1:]')
      expect(addPathSegment('items', ['', 3])).toBe('items[:3]')
      expect(addPathSegment('items', ['', ''])).toBe('items[*]')
    })

    test('adds PathNode segments', () => {
      const segment = parse('profile.email') as PathNode
      expect(addPathSegment('user', segment)).toBe('user.profile.email')

      const subscriptSegment = parse('[0]') as any // Type assertion needed
      expect(addPathSegment('items', subscriptSegment)).toBe('items[0]')
    })

    test('works with CompatPath arrays', () => {
      const path: CompatPath = ['user', 'profile']
      expect(addPathSegment(path, 'email')).toBe('user.profile.email')
      expect(addPathSegment(path, 0)).toBe('user.profile[0]')
      expect(addPathSegment(path, {_key: 'test'})).toBe('user.profile[_key=="test"]')
    })

    test('works with ExprNode input', () => {
      const ast = parse('user.profile')
      expect(addPathSegment(ast, 'email')).toBe('user.profile.email')
      expect(addPathSegment(ast, 0)).toBe('user.profile[0]')
    })

    test('handles special identifier names that need quoting', () => {
      expect(addPathSegment('user', 'field-name')).toBe("user.'field-name'")
      expect(addPathSegment('user', 'field with spaces')).toBe("user.'field with spaces'")
    })

    test('throws error for literal expressions', () => {
      expect(() => addPathSegment('42', 'field')).toThrow('Cannot add path segment to literal 42')
      expect(() => addPathSegment('"string"', 'field')).toThrow(
        'Cannot add path segment to literal "string"',
      )
    })

    test('handles complex chaining', () => {
      let path = 'data'
      path = addPathSegment(path, 'users')
      path = addPathSegment(path, 0)
      path = addPathSegment(path, 'profile')
      path = addPathSegment(path, {_key: 'email'})

      expect(path).toBe('data.users[0].profile[_key=="email"]')
    })

    test('preserves implicit root access', () => {
      expect(addPathSegment('.user', 'profile')).toBe('@.user.profile')
      expect(addPathSegment('..items', 'name')).toBe('@..items.name')
    })
  })

  describe('parsePath', () => {
    test('parses string paths', () => {
      const result = parsePath('user.profile.email')
      expect(result).toEqual({
        type: 'Path',
        base: {
          type: 'Path',
          base: {type: 'Path', segment: {name: 'user', type: 'Identifier'}},
          recursive: false,
          segment: {name: 'profile', type: 'Identifier'},
        },
        recursive: false,
        segment: {name: 'email', type: 'Identifier'},
      })
    })

    test('converts CompatPath arrays to ExprNode', () => {
      const compatPath: CompatPath = ['user', 'profile', 'email']
      const result = parsePath(compatPath)
      expect(result).toEqual({
        type: 'Path',
        base: {
          type: 'Path',
          base: {
            type: 'Path',
            recursive: false,
            segment: {name: 'user', type: 'Identifier'},
          },
          recursive: false,
          segment: {name: 'profile', type: 'Identifier'},
        },
        recursive: false,
        segment: {name: 'email', type: 'Identifier'},
      })
    })

    test('returns ExprNode unchanged', () => {
      const ast = parse('user.profile')
      const result = parsePath(ast)
      expect(result).toBe(ast) // Should be the same object
    })

    test('handles CompatPath with different segment types', () => {
      const compatPath: CompatPath = ['users', 0, {_key: 'profile'}, [1, 3], 'email']

      const result = parsePath(compatPath)
      expect(result).toEqual({
        type: 'Path',
        base: {
          type: 'Path',
          base: {
            type: 'Path',
            base: {
              type: 'Path',
              base: {
                type: 'Path',
                recursive: false,
                segment: {name: 'users', type: 'Identifier'},
              },
              recursive: false,
              segment: {type: 'Subscript', elements: [{type: 'Number', value: 0}]},
            },
            recursive: false,
            segment: {
              type: 'Subscript',
              elements: [
                {
                  type: 'Comparison',
                  left: {type: 'Path', segment: {name: '_key', type: 'Identifier'}},
                  operator: '==',
                  right: {type: 'String', value: 'profile'},
                },
              ],
            },
          },
          recursive: false,
          segment: {
            type: 'Subscript',
            elements: [{type: 'Slice', start: 1, end: 3}],
          },
        },
        recursive: false,
        segment: {name: 'email', type: 'Identifier'},
      })
    })

    test('treats IndexTuple with missing start and end as wildcard', () => {
      const compatPath: CompatPath = ['users', ['', '']]

      const result = parsePath(compatPath)
      expect(result).toEqual({
        type: 'Path',
        base: {
          type: 'Path',
          recursive: false,
          segment: {name: 'users', type: 'Identifier'},
        },
        recursive: false,
        segment: {
          type: 'Subscript',
          elements: [{type: 'Path', segment: {type: 'Wildcard'}}],
        },
      })
    })

    test('handles single segment CompatPath', () => {
      const compatPath: CompatPath = ['user']
      const result = parsePath(compatPath)
      expect(result).toEqual({
        type: 'Path',
        recursive: false,
        segment: {name: 'user', type: 'Identifier'},
      })
    })

    test('throws error for empty CompatPath', () => {
      expect(() => parsePath([])).toThrow('Path cannot be empty')
    })

    test('handles literal expressions', () => {
      const numberResult = parsePath('42')
      expect(numberResult).toEqual({type: 'Number', value: 42})

      const stringResult = parsePath('"test"')
      expect(stringResult).toEqual({type: 'String', value: 'test'})
    })
  })

  describe('createPathSet', () => {
    test('adds and checks simple string paths', () => {
      const pathSet = createPathSet()

      const path1 = ['user', 'name']
      const path2 = ['user', 'email']
      const path3 = ['profile', 'avatar']

      pathSet.add(path1)
      pathSet.add(path2)

      expect(pathSet.has(path1)).toBe(true)
      expect(pathSet.has(path2)).toBe(true)
      expect(pathSet.has(path3)).toBe(false)
    })

    test('adds and checks paths with numeric indices', () => {
      const pathSet = createPathSet()

      const path1 = ['users', 0, 'name']
      const path2 = ['users', 1, 'name']
      const path3 = ['users', 0, 'email']

      pathSet.add(path1)
      pathSet.add(path2)

      expect(pathSet.has(path1)).toBe(true)
      expect(pathSet.has(path2)).toBe(true)
      expect(pathSet.has(path3)).toBe(false)
    })

    test('adds and checks paths with keyed objects', () => {
      const pathSet = createPathSet()

      const path1 = ['users', {_key: 'alice'}, 'name']
      const path2 = ['users', {_key: 'bob'}, 'name']
      const path3 = ['users', {_key: 'alice'}, 'email']

      pathSet.add(path1)
      pathSet.add(path2)

      expect(pathSet.has(path1)).toBe(true)
      expect(pathSet.has(path2)).toBe(true)
      expect(pathSet.has(path3)).toBe(false)
    })

    test('handles mixed path segment types', () => {
      const pathSet = createPathSet()

      const path1 = ['data', 'users', 0, {_key: 'profile'}, 'settings', 'theme']
      const path2 = ['data', 'users', 1, {_key: 'profile'}, 'settings', 'theme']
      const path3 = ['data', 'users', 0, {_key: 'profile'}, 'settings', 'language']

      pathSet.add(path1)
      pathSet.add(path2)

      expect(pathSet.has(path1)).toBe(true)
      expect(pathSet.has(path2)).toBe(true)
      expect(pathSet.has(path3)).toBe(false)
    })

    test('handles duplicate additions', () => {
      const pathSet = createPathSet()

      const path = ['user', 'profile', 'email']

      pathSet.add(path)
      pathSet.add(path) // Add the same path again

      expect(pathSet.has(path)).toBe(true)
    })

    test('handles empty paths', () => {
      const pathSet = createPathSet()

      const emptyPath: Path = []

      pathSet.add(emptyPath)
      expect(pathSet.has(emptyPath)).toBe(false) // Empty paths should not be stored
    })

    test('distinguishes between different segment types with same string representation', () => {
      const pathSet = createPathSet()

      const pathWithString = ['users', 'profile', 'name']
      const pathWithKey = ['users', {_key: 'profile'}, 'name']
      const pathWithIndex = ['users', 0, 'name'] // 0 as number

      pathSet.add(pathWithString)
      pathSet.add(pathWithKey)

      expect(pathSet.has(pathWithString)).toBe(true)
      expect(pathSet.has(pathWithKey)).toBe(true)
      expect(pathSet.has(pathWithIndex)).toBe(false)
    })

    test('handles single segment paths', () => {
      const pathSet = createPathSet()

      const path1 = ['user']
      const path2 = ['profile']
      const path3 = [0]
      const path4 = [{_key: 'test'}]

      pathSet.add(path1)
      pathSet.add(path2)
      pathSet.add(path3)
      pathSet.add(path4)

      expect(pathSet.has(path1)).toBe(true)
      expect(pathSet.has(path2)).toBe(true)
      expect(pathSet.has(path3)).toBe(true)
      expect(pathSet.has(path4)).toBe(true)
      expect(pathSet.has(['notadded'])).toBe(false)
    })

    test('does not find partial paths', () => {
      const pathSet = createPathSet()

      const fullPath = ['data', 'users', 0, 'profile', 'name']
      pathSet.add(fullPath)

      expect(pathSet.has(fullPath)).toBe(true)
      expect(pathSet.has(['data'])).toBe(false)
      expect(pathSet.has(['data', 'users'])).toBe(false)
      expect(pathSet.has(['data', 'users', 0])).toBe(false)
      expect(pathSet.has(['data', 'users', 0, 'profile'])).toBe(false)
    })

    test('handles complex keyed object scenarios', () => {
      const pathSet = createPathSet()

      // Different keys should be treated as different paths
      const path1 = ['items', {_key: 'item-1'}, 'title']
      const path2 = ['items', {_key: 'item-2'}, 'title']
      const path3 = ['items', {_key: 'item-1'}, 'description']

      pathSet.add(path1)
      pathSet.add(path2)

      expect(pathSet.has(path1)).toBe(true)
      expect(pathSet.has(path2)).toBe(true)
      expect(pathSet.has(path3)).toBe(false)
    })
  })

  describe('integration tests', () => {
    test('complex path manipulation workflow', () => {
      // Start with a base path
      let path = 'data.users'

      // Add array index
      path = addPathSegment(path, 0)
      expect(path).toBe('data.users[0]')

      // Add keyed object lookup
      path = addPathSegment(path, {_key: 'profile'})
      expect(path).toBe('data.users[0][_key=="profile"]')

      // Add property access
      path = addPathSegment(path, 'email')
      expect(path).toBe('data.users[0][_key=="profile"].email')

      // Get parent path
      const parent = getParentPath(path)
      expect(parent).toBe('data.users[0][_key=="profile"]')

      // Parse the final path
      const parsed = parsePath(path)
      expect(parsed).toEqual({
        type: 'Path',
        base: {
          type: 'Path',
          base: {
            type: 'Path',
            base: {
              type: 'Path',
              base: {
                type: 'Path',
                segment: {name: 'data', type: 'Identifier'},
              },
              recursive: false,
              segment: {name: 'users', type: 'Identifier'},
            },
            recursive: false,
            segment: {
              type: 'Subscript',
              elements: [{type: 'Number', value: 0}],
            },
          },
          recursive: false,
          segment: {
            type: 'Subscript',
            elements: [
              {
                type: 'Comparison',
                left: {type: 'Path', segment: {name: '_key', type: 'Identifier'}},
                operator: '==',
                right: {type: 'String', value: 'profile'},
              },
            ],
          },
        },
        recursive: false,
        segment: {name: 'email', type: 'Identifier'},
      })
    })

    test('CompatPath to string conversion and back', () => {
      const originalCompatPath: CompatPath = [
        'data',
        'items',
        [1, 5],
        {_key: 'metadata'},
        'tags',
        0,
      ]

      // Convert to ExprNode
      const expr = parsePath(originalCompatPath)
      expect(stringifyPath(expr)).toBe('data.items[1:5][_key=="metadata"].tags[0]')

      // Add another segment
      const extended = addPathSegment(expr, 'name')
      expect(extended).toBe('data.items[1:5][_key=="metadata"].tags[0].name')

      // Parse it back
      const reparsed = parsePath(extended)
      expect(reparsed).toEqual({
        type: 'Path',
        base: {
          type: 'Path',
          base: {
            type: 'Path',
            base: {
              type: 'Path',
              base: {
                type: 'Path',
                base: {
                  base: {segment: {name: 'data', type: 'Identifier'}, type: 'Path'},
                  recursive: false,
                  segment: {name: 'items', type: 'Identifier'},
                  type: 'Path',
                },
                recursive: false,
                segment: {
                  type: 'Subscript',
                  elements: [{type: 'Slice', start: 1, end: 5}],
                },
              },
              recursive: false,
              segment: {
                type: 'Subscript',
                elements: [
                  {
                    left: {segment: {name: '_key', type: 'Identifier'}, type: 'Path'},
                    operator: '==',
                    right: {type: 'String', value: 'metadata'},
                    type: 'Comparison',
                  },
                ],
              },
            },
            recursive: false,
            segment: {name: 'tags', type: 'Identifier'},
          },
          recursive: false,
          segment: {elements: [{type: 'Number', value: 0}], type: 'Subscript'},
        },
        recursive: false,
        segment: {name: 'name', type: 'Identifier'},
      })
    })

    test('keyed array lookups with getIndexForKey', () => {
      const users = [
        {_key: 'user1', name: 'Alice', age: 25},
        {_key: 'user2', name: 'Bob', age: 30},
        {_key: 'user3', name: 'Carol', age: 35},
      ]

      // Get index for a specific key
      const index = getIndexForKey(users, 'user2')
      expect(index).toBe(1)

      // Use that index to build a path
      const path = addPathSegment('users', index!)
      expect(path).toBe('users[1]')

      // Add property access
      const fullPath = addPathSegment(path, 'name')
      expect(fullPath).toBe('users[1].name')

      // Get parent to go back to the user object
      const userPath = getParentPath(fullPath)
      expect(userPath).toBe('users[1]')
    })
  })
})
