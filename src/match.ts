import {
  type ComparisonNode,
  type ExistenceNode,
  type PathNode,
  type SegmentNode,
  type SubscriptNode,
  type ExprNode,
} from './parse'
import {
  type Path,
  type CompatPath,
  isKeyedObject,
  isRecord,
  createPathSet,
  parsePath,
  getIndexForKey,
} from './path'

const LITERAL_PATH: Path = []

/**
 * Represents a single match result from evaluating a JSONMatch expression.
 * Each entry contains the matched value and its path in the document.
 *
 * @example
 * ```typescript
 * const data = { users: [{ name: "Alice" }, { name: "Bob" }] }
 * const matches = Array.from(jsonMatch(data, "users[*].name"))
 * // matches = [
 * //   { value: "Alice", path: ["users", 0, "name"] },
 * //   { value: "Bob", path: ["users", 1, "name"] }
 * // ]
 * ```
 *
 * @public
 */
export interface MatchEntry {
  value: unknown
  path: Path
}

/**
 * Evaluates a JSONMatch expression against a JSON value and returns all matching entries.
 *
 * This is the core function of the library. It takes a JSON value and a JSONMatch expression
 * and returns a generator that yields all matching values along with their paths. The paths
 * returned are compatible with Sanity's path format and can be used for document operations.
 *
 * @param value - The JSON value to search within
 * @param expr - The JSONMatch expression (string, CompatPath array, or parsed AST)
 * @param basePath - Optional base path to prepend to all result paths
 * @returns Generator yielding MatchEntry objects for each match
 *
 * @example
 * Basic property access:
 * ```typescript
 * const data = { user: { name: "Alice", age: 25 } }
 * const matches = Array.from(jsonMatch(data, "user.name"))
 * // [{ value: "Alice", path: ["user", "name"] }]
 * ```
 *
 * @example
 * Array filtering with constraints:
 * ```typescript
 * const data = {
 *   users: [
 *     { name: "Alice", age: 25 },
 *     { name: "Bob", age: 30 }
 *   ]
 * }
 * const matches = Array.from(jsonMatch(data, "users[age > 28].name"))
 * // [{ value: "Bob", path: ["users", 1, "name"] }]
 * ```
 *
 * @example
 * Using the generator for efficient processing:
 * ```typescript
 * const data = { items: Array(1000).fill(0).map((_, i) => ({ id: i, active: i % 2 === 0 })) }
 *
 * // Find first active item efficiently without processing all items
 * for (const match of jsonMatch(data, "items[active == true]")) {
 *   console.log("First active item:", match.value)
 *   break
 * }
 * ```
 *
 * @public
 */
export function* jsonMatch(
  value: unknown,
  expr: string | CompatPath | ExprNode,
  basePath: Path = [],
): Generator<MatchEntry> {
  const visited = createPathSet()

  for (const entry of evaluateExpression({expr: parsePath(expr), value, path: basePath})) {
    const {path} = entry
    if (path === LITERAL_PATH) continue // skip literals
    if (visited.has(path)) continue
    visited.add(path)
    yield entry as MatchEntry
  }
}

type EvaluatorOptions<T> = T & {value: unknown; path: Path}

const itemEntry = (item: unknown, path: Path, index: number): MatchEntry => ({
  value: item,
  path: [...path, isKeyedObject(item) ? {_key: item._key} : index],
})

function* evaluateExpression({
  expr,
  value,
  path,
}: EvaluatorOptions<{expr: ExprNode}>): Generator<MatchEntry> {
  // If a Number, String, or Boolean node is here, then it's a literal value semantically
  // so we yield it without a path
  switch (expr.type) {
    case 'String':
    case 'Number':
    case 'Boolean': {
      yield {value: expr.value, path: LITERAL_PATH}
      return
    }
    case 'Path': {
      yield* evaluatePath({expr, value, path})
      return
    }
    default: {
      return
    }
  }
}

function* evaluatePath({
  expr,
  value,
  path,
}: EvaluatorOptions<{expr?: PathNode}>): Generator<MatchEntry> {
  if (!expr) {
    yield {value, path}
    return
  }

  for (const candidate of evaluatePath({expr: expr.base, value, path})) {
    if (expr.recursive) {
      yield* evaluateRecursivePath({segment: expr.segment, ...candidate})
      continue
    }

    yield* evaluateSegment({segment: expr.segment, ...candidate})
  }
}

function* evaluateRecursivePath({
  segment,
  value,
  path,
}: EvaluatorOptions<{segment: SegmentNode}>): Generator<MatchEntry> {
  // First try to match at current level
  yield* evaluateSegment({segment, value, path})

  // Then recursively search nested values
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const item = value[index]
      yield* evaluateRecursivePath({segment, ...itemEntry(item, path, index)})
    }
    return
  }

  if (isRecord(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      yield* evaluateRecursivePath({segment, value: nestedValue, path: [...path, key]})
    }
    return
  }
}

function* evaluateSegment({
  segment,
  value,
  path,
}: EvaluatorOptions<{segment: SegmentNode}>): Generator<MatchEntry> {
  switch (segment.type) {
    case 'This': {
      yield {value, path}
      return
    }

    case 'Identifier': {
      if (!isRecord(value)) return
      if (!(segment.name in value)) return
      yield {value: value[segment.name], path: [...path, segment.name]}
      return
    }

    case 'Subscript': {
      yield* evaluateSubscript({subscript: segment, value, path})
      return
    }

    case 'Wildcard': {
      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
          const item = value[index]
          yield itemEntry(item, path, index)
        }
        return
      }

      if (isRecord(value)) {
        for (const [key, nestedValue] of Object.entries(value)) {
          yield {value: nestedValue, path: [...path, key]}
        }
        return
      }

      return
    }

    default: {
      return
    }
  }
}

function* evaluateSubscript({
  value,
  subscript,
  path,
}: EvaluatorOptions<{subscript: SubscriptNode}>): Generator<MatchEntry> {
  // Process all subscript elements with union semantics (OR logic)
  for (const element of subscript.elements) {
    switch (element.type) {
      case 'Existence': {
        yield* evaluateExistence({existence: element, value, path})
        continue
      }

      case 'Comparison': {
        yield* evaluateComparison({comparison: element, value, path})
        continue
      }

      case 'Path': {
        yield* evaluatePath({expr: element, value, path})
        continue
      }

      case 'Slice': {
        if (!Array.isArray(value)) continue
        let start = element.start ?? 0
        let end = element.end ?? value.length
        if (start < 0) start = value.length + start
        if (end < 0) end = value.length + end

        // Clamp bounds to valid array indices
        start = Math.max(0, Math.min(start, value.length))
        end = Math.max(0, Math.min(end, value.length))

        for (let index = start; index < end; index++) {
          const item = value[index]
          yield itemEntry(item, path, index)
        }
        continue
      }

      // handle number nodes in subscripts as array indices
      case 'Number': {
        if (!Array.isArray(value)) continue

        const item = value.at(element.value)
        if (typeof item !== 'undefined') {
          let index = element.value
          if (index < 0) index = value.length + index
          index = Math.max(0, Math.min(index, value.length))
          yield itemEntry(item, path, index)
        }
        continue
      }

      // strings and booleans are always evaluated as literals
      case 'String':
      case 'Boolean': {
        yield* evaluateExpression({expr: element, value, path})
        continue
      }

      default: {
        continue
      }
    }
  }
}

function* evaluateExistence({
  existence,
  value,
  path,
}: EvaluatorOptions<{existence: ExistenceNode}>): Generator<MatchEntry> {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const item = value[index]
      yield* evaluateExistence({existence, ...itemEntry(item, path, index)})
    }
    return
  }

  const first = evaluatePath({expr: existence.base, path, value}).next()
  if (first.done) return
  yield {value, path}
}

function getKeyFromComparison({operator, left, right}: ComparisonNode) {
  if (operator !== '==') return undefined
  const keyPathNode = [left, right].find(isKeyPath)
  if (!keyPathNode) return undefined
  const other = left === keyPathNode ? right : left
  if (other.type !== 'String') return undefined
  return other.value
}

const isKeyPath = (node: ExprNode): node is PathNode => {
  if (node.type !== 'Path') return false
  if (node.base) return false
  if (node.recursive) return false
  if (node.segment.type !== 'Identifier') return false
  return node.segment.name === '_key'
}

function* evaluateComparison({
  comparison,
  value,
  path,
}: EvaluatorOptions<{comparison: ComparisonNode}>): Generator<MatchEntry> {
  if (Array.isArray(value)) {
    const _key = getKeyFromComparison(comparison)
    if (_key) {
      const index = getIndexForKey(value, _key)
      if (typeof index === 'undefined') return
      yield {value: value[index], path: [...path, {_key}]}
      return
    }

    for (let index = 0; index < value.length; index++) {
      const item = value[index]
      yield* evaluateComparison({comparison, ...itemEntry(item, path, index)})
    }
    return
  }

  const leftResult = evaluateExpression({expr: comparison.left, value, path}).next()
  const rightResult = evaluateExpression({expr: comparison.right, value, path}).next()
  // ensure left or right yielded at least one value
  if (leftResult.done || rightResult.done) return
  const {value: left} = leftResult.value
  const {value: right} = rightResult.value

  if (comparison.operator === '==') {
    if (left === right) yield {value, path}
    return
  }

  if (comparison.operator === '!=') {
    if (left !== right) yield {value, path}
    return
  }

  if (typeof left !== 'number' || typeof right !== 'number') return
  if (comparison.operator === '<' && left < right) yield {value, path}
  if (comparison.operator === '<=' && left <= right) yield {value, path}
  if (comparison.operator === '>' && left > right) yield {value, path}
  if (comparison.operator === '>=' && left >= right) yield {value, path}
}
