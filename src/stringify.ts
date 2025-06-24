import {type ExprNode, type PathNode, type SegmentNode, type SubscriptElementNode} from './parse'

/**
 * Converts a JSONMatch AST node back to its string representation.
 */
export function stringifyExpression(node: ExprNode): string {
  switch (node.type) {
    case 'String':
    case 'Number':
    case 'Boolean':
      return JSON.stringify(node.value)
    case 'Path':
      return stringifyPath(node)
    case 'Null':
      return 'null'
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

  // if the node is recursive, a `..` is always required
  if (node.recursive) return `${base}..${segment}`
  if (!base) return segment

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
    case 'Null':
    case 'Path':
      return stringifyExpression(node)
    default:
      throw new Error(
        `Unknown subscript element type: ${
          // @ts-expect-error this should be a `never` type
          node.type
        }`,
      )
  }
}
