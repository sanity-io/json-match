import {
  type ComparisonNode,
  type ExprNode,
  type IdentifierNode,
  type PathNode,
  type SegmentNode,
  type SubscriptElementNode,
  type SubscriptNode,
  parse,
} from './parse'
import {stringifyPath} from './stringify'

const KEY_PREFIX = 'key:'
const FIELD_PREFIX = 'field:'
const INDEX_PREFIX = 'index:'

type PathKey = `${typeof INDEX_PREFIX | typeof KEY_PREFIX | typeof FIELD_PREFIX}${string}`
type PathMap = Map<PathKey, PathMap | true>

interface PathSet {
  add(path: Path): void
  has(path: Path): boolean
}

export function createPathSet(): PathSet {
  const root: PathMap = new Map()

  function getKey(segment: PathSegment): PathKey {
    if (isKeyedObject(segment)) return `${KEY_PREFIX}${segment._key}`
    if (typeof segment === 'string') return `${FIELD_PREFIX}${segment}`
    return `${INDEX_PREFIX}${segment}`
  }

  function add(map: PathMap, [head, ...tail]: Path): void {
    if (typeof head === 'undefined') return

    const key = getKey(head)
    if (!tail.length) {
      map.set(key, true)
      return
    }

    const cached = map.get(key)
    if (typeof cached !== 'undefined') {
      if (cached === true) return
      add(cached, tail)
      return
    }

    const next = new Map<PathKey, PathMap | true>()
    map.set(key, next)
    add(next, tail)
  }

  function has(map: PathMap, [head, ...tail]: Path): boolean {
    if (typeof head === 'undefined') return false
    const key = getKey(head)
    const cached = map.get(key)
    if (typeof cached === 'undefined') return false
    if (!tail.length) return cached === true
    if (cached === true) return false
    return has(cached, tail)
  }

  return {
    add: (path: Path) => add(root, path),
    has: (path: Path) => has(root, path),
  }
}

const INDEX_CACHE = new WeakMap<unknown[], Record<string, number | undefined>>()

/** index tuple maps to a slice node */
type IndexTuple = [number | '', number | '']

/**
 * Represents a single segment in a path.
 *
 * @public
 */
export type PathSegment = string | number | {_key: string}

/**
 * Represents a path as an array of segments. This is the format used internally
 * and returned by `jsonMatch` in `MatchEntry` objects.
 *
 * Each segment can be:
 * - `string`: Object property name
 * - `number`: Array index
 * - `{_key: string}`: Keyed object reference
 *
 * @example
 * ```typescript
 * const path: Path = ['users', 0, 'profile', { _key: 'email' }]
 * // Represents: users[0].profile[_key=="email"]
 * ```
 *
 * @public
 */
export type Path = PathSegment[]

/**
 * Represents a path in the legacy Sanity format that includes index tuples for slicing.
 * This format supports all the capabilities of the Path type plus array slicing operations.
 *
 * @example
 * ```typescript
 * const compatPath: CompatPath = [
 *   'users',        // property access
 *   [1, 3],         // slice [1:3]
 *   { _key: 'profile' }, // keyed object
 *   'email'         // property access
 * ]
 * // Equivalent to: users[1:3][_key=="profile"].email
 * ```
 *
 * @public
 */
export type CompatPath = (PathSegment | IndexTuple)[]

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isKeyedObject(value: unknown): value is {_key: string} {
  return isRecord(value) && typeof (value as any)._key === 'string'
}
/**
 * Finds the array index for an object with a specific `_key` property.
 *
 * This function is optimized for Sanity's keyed arrays where objects have a special
 * `_key` property for stable references. It uses caching for performance when called
 * multiple times on the same array.
 *
 * @param input - The array to search in
 * @param key - The `_key` value to find
 * @returns The index of the object with the matching `_key`, or `undefined` if not found
 *
 * @example
 * Basic usage:
 * ```typescript
 * const items = [
 *   { _key: 'item1', name: 'First' },
 *   { _key: 'item2', name: 'Second' },
 *   { _key: 'item3', name: 'Third' }
 * ]
 *
 * const index = getIndexForKey(items, 'item2')
 * console.log(index) // 1
 * console.log(items[index]) // { _key: 'item2', name: 'Second' }
 * ```
 *
 * @example
 * Handling missing keys:
 * ```typescript
 * const index = getIndexForKey(items, 'nonexistent')
 * console.log(index) // undefined
 * ```
 *
 * @example
 * Performance with caching:
 * ```typescript
 * // First call builds cache
 * const index1 = getIndexForKey(largeArray, 'key1') // Slower
 * // Subsequent calls use cache
 * const index2 = getIndexForKey(largeArray, 'key2') // Faster
 * ```
 *
 * @public
 */
export function getIndexForKey(input: unknown, key: string): number | undefined {
  if (!Array.isArray(input)) return undefined
  const cached = INDEX_CACHE.get(input)
  if (cached) return cached[key]

  const lookup = input.reduce<Record<string, number | undefined>>((acc, next, index) => {
    if (typeof next?._key === 'string') acc[next._key] = index
    return acc
  }, {})

  INDEX_CACHE.set(input, lookup)
  return lookup[key]
}

function getExprForPath(path: CompatPath): PathNode {
  if (path.length === 0) {
    throw new Error('Path cannot be empty')
  }

  let result: PathNode | undefined
  for (let i = 0; i < path.length; i++) {
    result = {
      type: 'Path',
      base: result,
      recursive: false,
      segment: createSegmentNodeForPathSegment(path[i]),
    }
  }

  return result!
}

function createSegmentNodeForPathSegment(segment: PathSegment | IndexTuple): SegmentNode {
  // This is an IndexTuple - create a slice subscript
  if (Array.isArray(segment)) {
    const [start, end] = segment
    const element: SubscriptElementNode =
      start === '' && end === ''
        ? {type: 'Path', segment: {type: 'Wildcard'}}
        : {type: 'Slice', ...(start !== '' && {start}), ...(end !== '' && {end})}
    return {type: 'Subscript', elements: [element]}
  }

  if (typeof segment === 'string') {
    return {type: 'Identifier', name: segment}
  }

  if (typeof segment === 'number') {
    return {
      type: 'Subscript',
      elements: [{type: 'Number', value: segment}],
    }
  }

  if (isKeyedObject(segment)) {
    const comparisonNode: ComparisonNode = {
      type: 'Comparison',
      left: {type: 'Path', segment: {type: 'Identifier', name: '_key'}},
      operator: '==',
      right: {type: 'String', value: segment._key},
    }

    return {
      type: 'Subscript',
      elements: [comparisonNode],
    }
  }

  throw new Error(`Unsupported segment type: ${typeof segment}`)
}
/**
 * Extracts the parent path from a given path expression.
 *
 * This function removes the last segment from a path, returning the path to the parent
 * container. It works with string expressions, CompatPath arrays, and parsed AST nodes.
 * Returns `undefined` for root-level paths that have no parent.
 *
 * @param path - The path to get the parent of (string, CompatPath array, or AST)
 * @returns The parent path as a string, or `undefined` if no parent exists
 *
 * @example
 * String path expressions:
 * ```typescript
 * getParentPath('user.profile.email') // 'user.profile'
 * getParentPath('items[0].name') // 'items[0]'
 * getParentPath('data[*].tags') // 'data[*]'
 * getParentPath('user') // undefined (root level)
 * ```
 *
 * @example
 * CompatPath arrays:
 * ```typescript
 * getParentPath(['user', 'profile', 'email']) // 'user.profile'
 * getParentPath(['items', 0, 'name']) // 'items[0]'
 * getParentPath(['user']) // undefined
 * ```
 *
 * @example
 * Complex expressions:
 * ```typescript
 * getParentPath('users[age > 21].profile.email') // 'users[age>21].profile'
 * getParentPath('.bicycle.color') // '@.bicycle'
 * getParentPath('..items.name') // '@..items'
 * ```
 *
 * @public
 */
export function getParentPath(path: string | CompatPath | ExprNode): string | undefined {
  if (typeof path === 'string') return getParentPath(parse(path))
  if (Array.isArray(path)) return getParentPath(getExprForPath(path))
  if (path.type !== 'Path') return undefined
  if (!path.base) return undefined
  return stringifyPath(path.base)
}
/**
 * Adds a new segment to an existing path expression.
 *
 * This function extends a path by appending a new segment. It handles the complexity
 * of different segment types (strings, numbers, keyed objects, slices) and automatically
 * applies the correct syntax (dot notation vs bracket notation). It works with string
 * expressions, CompatPath arrays, and parsed AST nodes.
 *
 * @param path - The base path to extend (string, CompatPath array, or AST)
 * @param segmentToAdd - The segment to add (string, number, keyed object, slice, or PathNode)
 * @returns The extended path as a string
 *
 * @example
 * Adding property segments:
 * ```typescript
 * addPathSegment('user', 'profile') // 'user.profile'
 * addPathSegment('user.profile', 'email') // 'user.profile.email'
 * ```
 *
 * @example
 * Adding array indices:
 * ```typescript
 * addPathSegment('items', 0) // 'items[0]'
 * addPathSegment('users[0]', 'name') // 'users[0].name'
 * ```
 *
 * @example
 * Adding keyed object lookups:
 * ```typescript
 * addPathSegment('users', { _key: 'alice' }) // 'users[_key=="alice"]'
 * addPathSegment('data.items', { _key: 'item-1' }) // 'data.items[_key=="item-1"]'
 * ```
 *
 * @example
 * Adding slices:
 * ```typescript
 * addPathSegment('items', [1, 3]) // 'items[1:3]'
 * addPathSegment('items', [1, '']) // 'items[1:]'
 * addPathSegment('items', ['', 3]) // 'items[:3]'
 * addPathSegment('items', ['', '']) // 'items[*]'
 * ```
 *
 * @example
 * Working with CompatPath arrays:
 * ```typescript
 * const compatPath = ['user', 'profile']
 * addPathSegment(compatPath, 'email') // 'user.profile.email'
 * ```
 *
 * @example
 * Complex chaining:
 * ```typescript
 * let path = 'data'
 * path = addPathSegment(path, 'users')      // 'data.users'
 * path = addPathSegment(path, 0)            // 'data.users[0]'
 * path = addPathSegment(path, 'profile')    // 'data.users[0].profile'
 * path = addPathSegment(path, { _key: 'email' }) // 'data.users[0].profile[_key=="email"]'
 * ```
 *
 * @public
 */
export function addPathSegment(
  path: string | CompatPath | ExprNode,
  segmentToAdd: PathSegment | IndexTuple | PathNode,
) {
  if (typeof path === 'string') return addPathSegment(parse(path), segmentToAdd)
  if (Array.isArray(path)) return addPathSegment(getExprForPath(path), segmentToAdd)
  if (path.type === 'Number' || path.type === 'String') {
    throw new Error(`Cannot add path segment to literal ${JSON.stringify(path.value)}`)
  }
  if (typeof segmentToAdd === 'string') {
    const segment: IdentifierNode = {type: 'Identifier', name: segmentToAdd}
    return addPathSegment(path, {type: 'Path', segment})
  }
  if (typeof segmentToAdd === 'number') {
    const segment: SubscriptNode = {
      type: 'Subscript',
      elements: [{type: 'Number', value: segmentToAdd}],
    }
    return addPathSegment(path, {type: 'Path', segment})
  }
  if (isKeyedObject(segmentToAdd)) {
    const segment: SubscriptNode = {
      type: 'Subscript',
      elements: [
        {
          type: 'Comparison',
          left: {type: 'Path', segment: {type: 'Identifier', name: '_key'}},
          operator: '==',
          right: {type: 'String', value: segmentToAdd._key},
        },
      ],
    }
    return addPathSegment(path, {type: 'Path', segment})
  }
  if (Array.isArray(segmentToAdd)) {
    const [start, end] = segmentToAdd
    const element: SubscriptElementNode =
      start === '' && end === ''
        ? {type: 'Path', segment: {type: 'Wildcard'}}
        : {type: 'Slice', ...(start !== '' && {start}), ...(end !== '' && {end})}
    const segment: SubscriptNode = {
      type: 'Subscript',
      elements: [element],
    }
    return addPathSegment(path, {type: 'Path', segment})
  }

  // For PathNode segments, we need to find the root node and attach the base path to it
  function attachBaseToRoot(node: PathNode, newBase: PathNode): PathNode {
    if (!node.base) {
      // This is the root node, attach the new base here
      return {...node, base: newBase}
    }
    // Recursively find the root node
    return {...node, base: attachBaseToRoot(node.base, newBase)}
  }

  const mergedPath = attachBaseToRoot(segmentToAdd, path)
  return stringifyPath(mergedPath)
}

/**
 * Parses various path formats into a standardized JSONMatch AST.
 *
 * This function serves as a universal converter that can handle different path formats
 * used in the Sanity ecosystem. It converts string expressions, CompatPath arrays,
 * and returns AST nodes unchanged. This is useful for normalizing different path
 * representations before processing.
 *
 * @param path - The path to parse (string expression, CompatPath array, or existing AST)
 * @returns The parsed JSONMatch AST node
 *
 * @example
 * Parsing string expressions:
 * ```typescript
 * const ast = parsePath('user.profile.email')
 * // Returns a PathNode AST structure
 * ```
 *
 * @example
 * Converting CompatPath arrays:
 * ```typescript
 * const compatPath = ['users', 0, { _key: 'profile' }, 'email']
 * const ast = parsePath(compatPath)
 * // Converts to equivalent AST: users[0][_key=="profile"].email
 * ```
 *
 * @example
 * Identity operation on AST:
 * ```typescript
 * const existingAst = parse('items[*].name')
 * const result = parsePath(existingAst)
 * console.log(result === existingAst) // true (same object reference)
 * ```
 *
 * @example
 * Working with different segment types:
 * ```typescript
 * const complexPath = [
 *   'data',
 *   'items',
 *   [1, 5],              // slice
 *   { _key: 'metadata' }, // keyed object
 *   'tags',
 *   0                     // array index
 * ]
 * const ast = parsePath(complexPath)
 * console.log(stringifyPath(ast)) // 'data.items[1:5][_key=="metadata"].tags[0]'
 * ```
 *
 * @public
 */
export function parsePath(path: string | CompatPath | ExprNode): ExprNode {
  if (Array.isArray(path)) return getExprForPath(path)
  if (typeof path === 'string') return parse(path)
  return path
}
