import {type ExprNode, type PathNode, type SegmentNode, type SubscriptElementNode} from './parse'

/**
 * Converts a JSONMatch AST node back to its string representation.
 *
 * This function takes a parsed JSONMatch expression (AST) and converts it back to
 * a string format. This is useful for debugging, logging, or when you need to
 * serialize path expressions for storage or transmission.
 *
 * @param node - The JSONMatch AST node to stringify
 * @returns The string representation of the JSONMatch expression
 *
 * @example
 * Basic path stringification:
 * ```typescript
 * import { parse, stringifyPath } from 'jsonmatch'
 *
 * const ast = parse('users[age > 21].name')
 * const str = stringifyPath(ast)
 * console.log(str) // "users[age>21].name"
 * ```
 *
 * @example
 * Round-trip parsing and stringification:
 * ```typescript
 * const original = 'items[*].tags[0]'
 * const ast = parse(original)
 * const stringified = stringifyPath(ast)
 * console.log(stringified === original) // true
 * ```
 *
 * @example
 * Normalizing path expressions:
 * ```typescript
 * const messy = '  users  [  age  >  21  ] . name  '
 * const normalized = stringifyPath(parse(messy))
 * console.log(normalized) // "users[age>21].name"
 * ```
 *
 * @public
 */
function stringifyExpression(node: ExprNode): string {
  switch (node.type) {
    case 'String':
    case 'Number':
    case 'Boolean':
      return JSON.stringify(node.value)
    case 'Path':
      return stringifyPath(node)
    default:
      throw new Error(
        `Unknown node type: ${
          // @ts-expect-error should be `never` type
          node.type
        }`,
      )
  }
}

function stringifyPath(node: PathNode | undefined): string {
  if (!node) return ''

  const base = stringifyPath(node.base)
  const segment = stringifySegment(node.segment)

  if (!base) return segment

  // if the node is recursive, a `..` is always required
  if (node.recursive) return `${base}..${segment}`
  // if the next segment starts with a `[` then we can omit the `.`
  if (segment.startsWith('[')) return `${base}${segment}`
  // otherwise, we need the `.`
  return `${base}.${segment}`
}

function stringifySegment(segment: SegmentNode): string {
  switch (segment.type) {
    case 'This':
      return '@'
    case 'Wildcard':
      return '*'
    case 'Subscript':
      return `[${segment.elements.map(stringifySubscriptElement).join(',')}]`
    case 'Identifier':
      return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(segment.name)
        ? segment.name
        : escapeIdentifier(segment.name)
    default:
      throw new Error(`Unknown segment type: ${(segment as any).type}`)
  }
}

function escapeIdentifier(value: string): string {
  const jsonString = JSON.stringify(value)
  // Remove outer double quotes and escape single quotes
  const content = jsonString.slice(1, -1).replace(/'/g, "\\'").replace(/\\"/g, '"')
  return `'${content}'`
}

function stringifySubscriptElement(node: SubscriptElementNode): string {
  switch (node.type) {
    case 'Slice':
      return `${node.start ?? ''}:${node.end ?? ''}`
    case 'Comparison':
      return `${stringifyExpression(node.left)}${node.operator}${stringifyExpression(node.right)}`
    case 'Existence':
      return `${stringifyPath(node.base)}?`
    case 'String':
    case 'Number':
    case 'Boolean':
    case 'Path':
      return stringifyExpression(node)
    default:
      throw new Error(`Unknown subscript element type: ${(node as any).type}`)
  }
}

export {stringifyExpression as stringifyPath}
