import {describe, test, expect} from 'vitest'
import {
  getIndexForKey,
  parsePath,
  createPathSet,
  getPathDepth,
  slicePath,
  joinPaths,
  type Path,
} from './path'
import {parse} from './parse'

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

    test('converts Path arrays to ExprNode', () => {
      const path: Path = ['user', 'profile', 'email']
      const result = parsePath(path)
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

    test('handles Path with different segment types', () => {
      const path: Path = ['users', 0, {_key: 'profile'}, [1, 3], 'email']

      const result = parsePath(path)
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
      const path: Path = ['users', ['', '']]

      const result = parsePath(path)
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

    test('handles single segment Path', () => {
      const path: Path = ['user']
      const result = parsePath(path)
      expect(result).toEqual({
        type: 'Path',
        recursive: false,
        segment: {name: 'user', type: 'Identifier'},
      })
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

  describe('getPathDepth', () => {
    test('returns correct depth for simple string paths', () => {
      expect(getPathDepth('user')).toBe(1)
      expect(getPathDepth('user.profile')).toBe(2)
      expect(getPathDepth('user.profile.email')).toBe(3)
      expect(getPathDepth('user.profile.email.domain')).toBe(4)
    })

    test('returns correct depth for paths with array indices', () => {
      expect(getPathDepth('items[0]')).toBe(2)
      expect(getPathDepth('items[0].name')).toBe(3)
      expect(getPathDepth('users[0].profile.email')).toBe(4)
      expect(getPathDepth('matrix[0][1]')).toBe(3)
    })

    test('returns correct depth for paths with keyed objects', () => {
      expect(getPathDepth('users[_key=="alice"]')).toBe(2)
      expect(getPathDepth('users[_key=="alice"].profile')).toBe(3)
      expect(getPathDepth('data.items[_key=="special"].tags[0]')).toBe(5)
    })

    test('returns correct depth for paths with wildcards and slices', () => {
      expect(getPathDepth('items[*]')).toBe(2)
      expect(getPathDepth('items[*].name')).toBe(3)
      expect(getPathDepth('items[1:3]')).toBe(2)
      expect(getPathDepth('items[1:3].tags[*]')).toBe(4)
    })

    test('returns correct depth for paths with complex expressions', () => {
      expect(getPathDepth('users[age > 21]')).toBe(2)
      expect(getPathDepth('users[age > 21].profile.email')).toBe(4)
      expect(getPathDepth('data[*].items[price < 100].name')).toBe(5)
    })

    test('returns correct depth for paths with recursive descent', () => {
      expect(getPathDepth('data..name')).toBe(2)
      expect(getPathDepth('root.data..items.name')).toBe(4)
      expect(getPathDepth('root..data..items..name')).toBe(4)
    })

    test('returns correct depth for paths with this context', () => {
      expect(getPathDepth('@')).toBe(0)
      expect(getPathDepth('$.config')).toBe(1)
      expect(getPathDepth('@.user.profile')).toBe(2)
      expect(getPathDepth('.bicycle.color')).toBe(2)
    })

    test('returns correct depth for Path arrays', () => {
      expect(getPathDepth(['user'])).toBe(1)
      expect(getPathDepth(['user', 'profile'])).toBe(2)
      expect(getPathDepth(['user', 'profile', 'email'])).toBe(3)
      expect(getPathDepth(['items', 0, 'name'])).toBe(3)
      expect(getPathDepth(['users', {_key: 'alice'}, 'profile'])).toBe(3)
      expect(getPathDepth(['items', [1, 3], 'name'])).toBe(3)
    })

    test('returns correct depth for ExprNode AST objects', () => {
      const ast1 = parse('user.profile.email')
      expect(getPathDepth(ast1)).toBe(3)

      const ast2 = parse('items[0].tags[*]')
      expect(getPathDepth(ast2)).toBe(4)

      const ast3 = parse('users[age > 21].profile')
      expect(getPathDepth(ast3)).toBe(3)
    })

    test('returns 0 for non-path expressions', () => {
      expect(getPathDepth('42')).toBe(0)
      expect(getPathDepth('"string"')).toBe(0)
      expect(getPathDepth('true')).toBe(0)
    })

    test('handles empty Path array', () => {
      expect(getPathDepth([])).toBe(0)
    })

    test('handles edge cases', () => {
      // Single character paths
      expect(getPathDepth('a')).toBe(1)
      expect(getPathDepth('a.b')).toBe(2)

      // Quoted identifiers
      expect(getPathDepth("'field-name'")).toBe(1)
      expect(getPathDepth("user.'field-name'.value")).toBe(3)

      // Numbers as identifiers
      expect(getPathDepth('[0]')).toBe(1)
      expect(getPathDepth('[0].name')).toBe(2)
    })
  })

  describe('slicePath', () => {
    test('returns empty string for empty or undefined paths', () => {
      expect(slicePath(undefined)).toBe('')
      expect(slicePath('')).toBe('')
      expect(slicePath([])).toBe('')
    })

    test('slices string paths from start', () => {
      expect(slicePath('user.profile.email.domain', 1)).toBe('profile.email.domain')
      expect(slicePath('user.profile.email.domain', 2)).toBe('email.domain')
      expect(slicePath('user.profile.email.domain', 3)).toBe('domain')
    })

    test('slices string paths with start and end', () => {
      expect(slicePath('user.profile.email.domain', 1, 3)).toBe('profile.email')
      expect(slicePath('user.profile.email.domain', 0, 2)).toBe('user.profile')
      expect(slicePath('user.profile.email.domain', 2, 4)).toBe('email.domain')
    })

    test('slices paths with array indices', () => {
      expect(slicePath('items[0].name.first', 1)).toBe('[0].name.first')
      expect(slicePath('items[0].name.first', 0, 2)).toBe('items[0]')
      expect(slicePath('users[0].profile[1].tags', 2, 4)).toBe('profile[1]')
    })

    test('slices paths with keyed objects', () => {
      expect(slicePath('users[_key=="alice"].profile.email', 1)).toBe(
        '[_key=="alice"].profile.email',
      )
      expect(slicePath('users[_key=="alice"].profile.email', 0, 2)).toBe('users[_key=="alice"]')
      expect(slicePath('data.items[_key=="special"].tags[0]', 2, 4)).toBe('[_key=="special"].tags')
    })

    test('slices Path arrays', () => {
      const path: Path = ['user', 'profile', 'email', 'domain']
      expect(slicePath(path, 1)).toBe('profile.email.domain')
      expect(slicePath(path, 1, 3)).toBe('profile.email')
      expect(slicePath(path, 0, 2)).toBe('user.profile')
    })

    test('slices Path with mixed segment types', () => {
      const path: Path = ['users', 0, {_key: 'profile'}, 'email']
      expect(slicePath(path, 1)).toBe('[0][_key=="profile"].email')
      expect(slicePath(path, 0, 2)).toBe('users[0]')
      expect(slicePath(path, 2, 4)).toBe('[_key=="profile"].email')
    })

    test('slices Path with index tuples', () => {
      const path: Path = ['items', [1, 3], 'name', 'first']
      expect(slicePath(path, 1)).toBe('[1:3].name.first')
      expect(slicePath(path, 0, 2)).toBe('items[1:3]')
      expect(slicePath(path, 2)).toBe('name.first')
    })

    test('slices ExprNode AST objects', () => {
      const ast = parse('user.profile.email.domain')
      expect(slicePath(ast, 1)).toBe('profile.email.domain')
      expect(slicePath(ast, 1, 3)).toBe('profile.email')
      expect(slicePath(ast, 0, 2)).toBe('user.profile')
    })

    test('handles negative indices', () => {
      expect(slicePath('user.profile.email.domain', -2)).toBe('email.domain')
      expect(slicePath('user.profile.email.domain', -3, -1)).toBe('profile.email')
      expect(slicePath('user.profile.email.domain', 1, -1)).toBe('profile.email')
    })

    test('handles out of bounds indices', () => {
      expect(slicePath('user.profile', 5)).toBe('')
      expect(slicePath('user.profile', 0, 10)).toBe('user.profile')
      expect(slicePath('user.profile', -10)).toBe('user.profile')
      expect(slicePath('user.profile', -10, 1)).toBe('user')
    })

    test('handles edge cases with start >= end', () => {
      expect(slicePath('user.profile.email', 2, 2)).toBe('')
      expect(slicePath('user.profile.email', 3, 2)).toBe('')
      expect(slicePath('user.profile.email', 5, 3)).toBe('')
    })

    test('slices single segment paths', () => {
      expect(slicePath('user', 0)).toBe('user')
      expect(slicePath('user', 1)).toBe('')
      expect(slicePath('user', 0, 1)).toBe('user')
      expect(slicePath(['user'], 0, 1)).toBe('user')
    })

    test('handles paths with wildcards and complex expressions', () => {
      expect(slicePath('items[*].name.first', 1)).toBe('[*].name.first')
      expect(slicePath('users[age > 21].profile.email', 0, 2)).toBe('users[age>21]')
      expect(slicePath('data[*][price < 100].name', 2)).toBe('[price<100].name')
    })

    test('handles paths with recursive descent', () => {
      expect(slicePath('data..items.name', 1)).toBe('..items.name')
      expect(slicePath('root.data..items.name', 2)).toBe('..items.name')
      expect(slicePath('root.data..items.name', 0, 3)).toBe('root.data..items')
    })

    test('returns original path when no slicing parameters provided', () => {
      expect(slicePath('user.profile.email')).toBe('user.profile.email')
      expect(slicePath(['user', 'profile', 'email'])).toBe('user.profile.email')
      const ast = parse('user.profile.email')
      expect(slicePath(ast)).toBe('user.profile.email')
    })

    test('does not handles non-path expressions', () => {
      expect(slicePath('42')).toBe('')
      expect(slicePath('"string"')).toBe('')
      expect(slicePath('true')).toBe('')
    })
  })

  describe('joinPaths', () => {
    test('joins simple string paths', () => {
      expect(joinPaths('user', 'profile')).toBe('user.profile')
      expect(joinPaths('user.profile', 'email')).toBe('user.profile.email')
      expect(joinPaths('data', 'users[0].name')).toBe('data.users[0].name')
    })

    test('joins string paths with array indices', () => {
      expect(joinPaths('users[0]', 'profile')).toBe('users[0].profile')
      expect(joinPaths('items[0]', 'tags[1]')).toBe('items[0].tags[1]')
      expect(joinPaths('matrix[0][1]', 'value')).toBe('matrix[0][1].value')
    })

    test('joins string paths with keyed objects', () => {
      expect(joinPaths('users[_key=="alice"]', 'profile')).toBe('users[_key=="alice"].profile')
      expect(joinPaths('data', 'items[_key=="special"].tags')).toBe(
        'data.items[_key=="special"].tags',
      )
    })

    test('joins string paths with wildcards and slices', () => {
      expect(joinPaths('items[*]', 'name')).toBe('items[*].name')
      expect(joinPaths('items[1:3]', 'tags')).toBe('items[1:3].tags')
      expect(joinPaths('data[*]', 'items[price<100].name')).toBe('data[*].items[price<100].name')
    })

    test('joins Path arrays', () => {
      const basePath: Path = ['user', 'profile']
      const path: Path = ['email', 'domain']
      expect(joinPaths(basePath, path)).toBe('user.profile.email.domain')
    })

    test('joins Path with mixed segment types', () => {
      const basePath: Path = ['users', 0, {_key: 'profile'}]
      const path: Path = ['email', 'domain']
      expect(joinPaths(basePath, path)).toBe('users[0][_key=="profile"].email.domain')
    })

    test('joins Path with index tuples', () => {
      const basePath: Path = ['items', [1, 3]]
      const path: Path = ['name', 'first']
      expect(joinPaths(basePath, path)).toBe('items[1:3].name.first')
    })

    test('joins ExprNode AST objects', () => {
      const baseAst = parse('user.profile')
      const pathAst = parse('email.domain')
      expect(joinPaths(baseAst, pathAst)).toBe('user.profile.email.domain')
    })

    test('joins mixed input types', () => {
      // String + Path
      expect(joinPaths('user', ['profile', 'email'])).toBe('user.profile.email')

      // Path + String
      expect(joinPaths(['user', 'profile'], 'email')).toBe('user.profile.email')

      // String + ExprNode
      const pathAst = parse('email.domain')
      expect(joinPaths('user.profile', pathAst)).toBe('user.profile.email.domain')

      // ExprNode + String
      const baseAst = parse('user.profile')
      expect(joinPaths(baseAst, 'email.domain')).toBe('user.profile.email.domain')

      // Path + ExprNode
      const pathArr: Path = ['user', 'profile']
      expect(joinPaths(pathArr, pathAst)).toBe('user.profile.email.domain')

      // ExprNode + Path
      expect(joinPaths(baseAst, pathArr)).toBe('user.profile.user.profile')
    })

    test('handles undefined or empty inputs', () => {
      // Undefined base
      expect(joinPaths(undefined, 'user.profile')).toBe('user.profile')
      expect(joinPaths(undefined, ['user', 'profile'])).toBe('user.profile')

      // Undefined path
      expect(joinPaths('user.profile', undefined)).toBe('user.profile')
      expect(joinPaths(['user', 'profile'], undefined)).toBe('user.profile')

      // Both undefined
      expect(joinPaths(undefined, undefined)).toBe('')

      // Empty string base
      expect(joinPaths('', 'user.profile')).toBe('user.profile')

      // Empty string path
      expect(joinPaths('user.profile', '')).toBe('user.profile')

      // Empty arrays
      expect(joinPaths([], 'user.profile')).toBe('user.profile')
      expect(joinPaths('user.profile', [])).toBe('user.profile')
    })

    test('handles single segment paths', () => {
      expect(joinPaths('user', 'profile')).toBe('user.profile')
      expect(joinPaths(['user'], 'profile')).toBe('user.profile')
      expect(joinPaths('user', ['profile'])).toBe('user.profile')
      expect(joinPaths(['user'], ['profile'])).toBe('user.profile')
    })

    test('handles complex nested paths', () => {
      const complexBase = 'data.users[age>21].profile.settings'
      const complexPath = 'theme.dark[enabled==true].colors'
      expect(joinPaths(complexBase, complexPath)).toBe(
        'data.users[age>21].profile.settings.theme.dark[enabled==true].colors',
      )
    })

    test('handles paths with recursive descent', () => {
      expect(joinPaths('data..items', 'name')).toBe('data..items.name')
      expect(joinPaths('root', 'data..items..name')).toBe('root.data..items..name')
    })

    test('handles paths with this context', () => {
      expect(joinPaths('@', 'user.profile')).toBe('@.user.profile')
      expect(joinPaths('$.config', 'theme')).toBe('@.config.theme')
    })

    test('handles non-path expressions gracefully', () => {
      // Non-path expressions should be treated as empty
      expect(joinPaths('42', 'user.profile')).toBe('user.profile')
      expect(joinPaths('user.profile', '42')).toBe('user.profile')
      expect(joinPaths('"string"', 'user.profile')).toBe('user.profile')
      expect(joinPaths('user.profile', '"string"')).toBe('user.profile')
      expect(joinPaths('true', 'user.profile')).toBe('user.profile')
      expect(joinPaths('user.profile', 'true')).toBe('user.profile')
    })

    test('handles edge cases with special characters', () => {
      // Quoted identifiers
      expect(joinPaths("user.'field-name'", 'value')).toBe("user.'field-name'.value")

      // Numbers as identifiers
      expect(joinPaths('[0]', 'name')).toBe('[0].name')
      expect(joinPaths('user', '[0]')).toBe('user[0]')
    })

    test('preserves path structure and formatting', () => {
      // Should maintain proper spacing and formatting
      const messyBase = '  user  .  profile  '
      const messyPath = '  email  .  domain  '
      expect(joinPaths(messyBase, messyPath)).toBe('user.profile.email.domain')
    })

    test('handles deeply nested paths', () => {
      const deepBase = 'a.b.c.d.e.f.g.h.i.j'
      const deepPath = 'k.l.m.n.o.p.q.r.s.t'
      expect(joinPaths(deepBase, deepPath)).toBe('a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t')
    })

    test('handles paths with all segment types', () => {
      const complexBase: Path = ['data', 'users', 0, {_key: 'profile'}, [1, 3], 'settings']
      const complexPath: Path = ['theme', 'dark', {_key: 'colors'}, 'primary']
      expect(joinPaths(complexBase, complexPath)).toBe(
        'data.users[0][_key=="profile"][1:3].settings.theme.dark[_key=="colors"].primary',
      )
    })
  })
})
