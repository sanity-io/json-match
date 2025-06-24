import {
  type ComparisonNode,
  type ExprNode,
  type PathNode,
  type SegmentNode,
  type SubscriptElementNode,
  parse,
} from './parse'
import {stringifyExpression} from './stringify'

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

type IndexTuple = [number | '', number | '']
type KeyedSegment = {_key: string}

/**
 * Represents a single segment in a path.
 *
 * @public
 */
export type PathSegment = string | number | KeyedSegment | IndexTuple

/**
 * Represents a path as an array of segments. This is the format used internally
 * and returned by `jsonMatch` in `MatchEntry` objects.
 *
 * Each segment can be:
 * - `string`: Object property name
 * - `number`: Array index
 * - `{_key: string}`: Keyed object reference
 * - `[number | '', number | '']`: Array slices
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
 * Equivalent to the normal {@link Path} array but without the index tuple.
 * These paths are meant to locate only one value (no index tuple)
 * @public
 */
export type SingleValuePath = Exclude<PathSegment, IndexTuple>[]

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isKeyedObject(value: unknown): value is {_key: string} {
  return isRecord(value) && typeof (value as any)._key === 'string'
}

/**
 * Converts various path formats to their string representation.
 *
 * This function serves as a universal converter that can handle different path formats
 * used in the Sanity ecosystem. It converts JSONMatch AST nodes and Path arrays
 * to string expressions, while returning string inputs unchanged. This is useful for
 * normalizing different path representations into a consistent string format.
 *
 * @param path - The path to stringify (string expression, Path array, or AST node)
 * @returns The path as a string expression
 *
 * @example
 * Converting AST nodes to strings:
 * ```typescript
 * import { parsePath, stringifyPath } from '@sanity/json-match'
 *
 * const ast = parsePath('users[age > 21].name')
 * const str = stringifyPath(ast) // "users[age>21].name"
 * ```
 *
 * @example
 *
 * Converting `Path` arrays to strings:
 *
 * ```typescript
 * const path = ['users', 0, { _key: 'profile' }, 'email']
 * const str = stringifyPath(path) // 'users[0][_key=="profile"].email'
 *
 * const withSlice = ['items', [1, 3], 'name']
 * const sliceStr = stringifyPath(withSlice) // "items[1:3].name"
 * ```
 *
 * @example
 * Identity operation on strings:
 * ```typescript
 * const existing = 'items[*].name'
 * const result = stringifyPath(existing) // "items[*].name" (same string)
 * ```
 *
 * @example
 * Normalizing expressions:
 * ```typescript
 * const messy = '  users  [  age  >  21  ] . name  '
 * const clean = stringifyPath(parsePath(messy)) // "users[age>21].name"
 * ```
 *
 * @public
 */
export function stringifyPath(path: ExprNode | Path | string | undefined): string {
  if (!path) return ''
  if (typeof path === 'string') return path
  if (Array.isArray(path)) return stringifyPath(parsePath(path))
  return stringifyExpression(path)
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

/**
 * Parses various path formats into a standardized JSONMatch AST.
 *
 * This function serves as a universal converter that can handle different path formats
 * used in the Sanity ecosystem. It converts string expressions, Path arrays,
 * and returns AST nodes unchanged. This is useful for normalizing different path
 * representations before processing.
 *
 * @param path - The path to parse (string expression, Path array, or existing AST)
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
 * Converting Path arrays:
 * ```typescript
 * const pathArr = ['users', 0, { _key: 'profile' }, 'email']
 * const ast = parsePath(pathArr)
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
export function parsePath(path: string | Path | ExprNode): ExprNode | undefined {
  if (Array.isArray(path)) {
    let result: PathNode | undefined
    for (const segment of path) {
      result = {
        type: 'Path',
        base: result,
        recursive: false,
        segment: convertArraySegmentToSegmentNode(segment),
      }
    }

    return result
  }

  if (typeof path === 'string') return parse(path)
  return path
}

function convertArraySegmentToSegmentNode(segment: PathSegment): SegmentNode {
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
 * Calculates the depth of a path, which is the number of segments.
 *
 * This function supports multiple path formats, including string expressions,
 * Path arrays, and AST nodes. It provides a consistent way to measure the
 * complexity or length of a path regardless of its representation.
 *
 * @param path - The path to measure (string, Path array, or AST node).
 * @returns The number of segments in the path.
 *
 * @example
 * Basic usage with different path formats:
 * ```typescript
 * import { getPathDepth } from '@sanity/json-match'
 *
 * const pathStr = 'user.profile.email'
 * console.log(getPathDepth(pathStr)) // 3
 *
 * const pathArr = ['user', 'profile', 'email']
 * console.log(getPathDepth(pathArr)) // 3
 *
 * const pathWithIndex = 'users[0].name'
 * console.log(getPathDepth(pathWithIndex)) // 3
 * ```
 *
 * @public
 */
export function getPathDepth(path: string | Path | ExprNode | undefined): number {
  if (!path) return 0
  if (Array.isArray(path)) return path.length
  if (typeof path === 'string') return getPathDepth(parsePath(path))
  if (path.type !== 'Path') return 0
  const segmentDepth =
    path.segment.type === 'Subscript' ||
    path.segment.type === 'Wildcard' ||
    path.segment.type === 'Identifier'
      ? 1
      : 0
  return getPathDepth(path.base) + segmentDepth
}

function* drop<T>(values: Iterable<T>, count: number) {
  let index = 0
  for (const value of values) {
    if (index >= count) yield value
    index++
  }
}

function* getSegments(node: PathNode): Generator<PathNode> {
  if (node.base) yield* getSegments(node.base)
  if (node.segment.type !== 'This') yield node
}

/**
 * Extracts a section of a path and returns it as a new path string.
 *
 * This function works like `Array.prototype.slice` for path segments. It supports
 * different path formats and handles both positive and negative indices for slicing.
 * This is particularly useful for tasks like getting a parent path or isolating
 * specific parts of a path.
 *
 * @param path - The path to slice (string, Path array, or AST node).
 * @param start - The zero-based index at which to begin extraction. Negative indices are counted from the end.
 * @param end - The zero-based index before which to end extraction. `slice` extracts up to but not including `end`. Negative indices are counted from the end.
 * @returns A new string containing the extracted path segments.
 *
 * @example
 * Basic slicing:
 * ```typescript
 * import { slicePath } from '@sanity/json-match'
 *
 * const path = 'a.b.c.d.e'
 * console.log(slicePath(path, 1, 4)) // "b.c.d"
 * console.log(slicePath(path, 2))    // "c.d.e"
 * ```
 *
 * @example
 * Getting the parent path:
 * ```typescript
 * import { slicePath, getPathDepth } from '@sanity/json-match'
 *
 * const fullPath = 'user.profile.settings.theme'
 *
 * // Using negative indices:
 * const parentPathNegative = slicePath(fullPath, 0, -1)
 * console.log(parentPathNegative) // "user.profile.settings"
 * ```
 *
 * @example
 * Getting the last segment of a path:
 * ```typescript
 * import { slicePath } from '@sanity/json-match'
 *
 * const path = 'user.profile.email'
 * const lastSegment = slicePath(path, -1)
 * console.log(lastSegment) // "email"
 *
 * const complexPath = 'items[0].tags[_key=="abc"].name'
 * const lastSegmentComplex = slicePath(complexPath, -1)
 * console.log(lastSegmentComplex) // "name"
 * ```
 *
 * @public
 */
export function slicePath(
  path: string | Path | ExprNode | undefined,
  start?: number,
  end?: number,
): string {
  if (!path) return ''
  if (typeof path === 'string') return slicePath(parsePath(path), start, end)
  if (Array.isArray(path)) return slicePath(parsePath(path), start, end)
  if (path.type !== 'Path') return ''

  const depth = getPathDepth(path)
  if (typeof start === 'undefined') start = 0
  if (start < 0) start = start + depth
  if (typeof end === 'undefined') end = depth
  if (end < 0) end = end + depth

  // Normalize bounds
  start = Math.max(0, Math.min(start, depth))
  end = Math.max(0, Math.min(end, depth))

  // If slice is empty or invalid, return empty string
  if (start >= end) return ''

  // slicing the end is easy, just keep scoping in
  if (end < depth) return slicePath(path.base, start, end)

  let base
  for (const segment of drop(getSegments(path), start)) {
    base = {...segment, base}
  }
  return stringifyPath(base)
}

/**
 * Joins two path segments into a single, normalized path string.
 *
 * This function is useful for programmatically constructing paths from a base
 * and an additional segment. It handles various path formats, ensuring that
 * the resulting path is correctly formatted.
 *
 * @param base - The base path (string, Path array, or AST node).
 * @param path - The path segment to append (string, Path array, or AST node).
 * @returns A new string representing the combined path.
 *
 * @example
 * Basic joining:
 * ```typescript
 * import { joinPaths } from '@sanity/json-match'
 *
 * const basePath = 'user.profile'
 * const newSegment = 'email'
 * const fullPath = joinPaths(basePath, newSegment)
 * console.log(fullPath) // "user.profile.email"
 * ```
 *
 * @example
 * Replacing the last segment of a path:
 * ```typescript
 * import { joinPaths, slicePath } from '@sanity/json-match'
 *
 * const originalPath = 'user.profile.email'
 * const parentPath = slicePath(originalPath, 0, -1) // "user.profile"
 * const newPath = joinPaths(parentPath, 'contactInfo')
 * console.log(newPath) // "user.profile.contactInfo"
 * ```
 *
 * @example
 * Building paths with array-like segments:
 * ```typescript
 * import { joinPaths } from '@sanity/json-match'
 *
 * let base = 'items'
 * base = joinPaths(base, '[0]') // "items[0]"
 * base = joinPaths(base, '[_key=="abc"]') // "items[0][_key=="abc"]"
 * base = joinPaths(base, 'title') // "items[0][_key=="abc"].title"
 * console.log(base)
 * ```
 *
 * @public
 */
export function joinPaths(
  base: string | Path | ExprNode | undefined,
  path: string | Path | ExprNode | undefined,
): string {
  if (!base) return stringifyPath(path)
  if (Array.isArray(base)) return joinPaths(parsePath(base), path)
  if (typeof base === 'string') return joinPaths(parsePath(base), path)
  if (base.type !== 'Path') return stringifyPath(path)
  if (!path) return stringifyPath(base)
  if (Array.isArray(path)) return joinPaths(base, parsePath(path))
  if (typeof path === 'string') return joinPaths(base, parsePath(path))
  if (path.type !== 'Path') return stringifyPath(base)

  for (const segment of getSegments(path)) {
    base = {...segment, base}
  }
  return stringifyPath(base)
}
