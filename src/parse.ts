import {tokenize, type Token} from './tokenize'
import {createCursor, type Cursor} from './cursor'

/**
 * The root type for all JSONMatch expression nodes.
 *
 * @public
 */
export type ExprNode = NumberNode | StringNode | BooleanNode | NullNode | PathNode

/**
 * Represents a path expression in the JSONMatch AST.
 * This is the most common type of expression, representing navigation through an object or array.
 *
 * @public
 */
export type PathNode = {
  type: 'Path'
  base?: PathNode // the preceding context (what we apply the current segment to)
  recursive?: boolean // true for '..' recursive descent, false/undefined for normal '.' descent
  segment: SegmentNode // current operation to apply
}

/**
 * Represents different types of path segments in the JSONMatch AST.
 *
 * @public
 */
export type SegmentNode = ThisNode | IdentifierNode | WildcardNode | SubscriptNode

/**
 * Represents a subscript operation (bracket notation) in the JSONMatch AST.
 * Can contain multiple elements that are combined with union (OR) semantics.
 *
 * @public
 */
export type SubscriptNode = {
  type: 'Subscript'
  elements: SubscriptElementNode[]
}

/**
 * Represents elements that can appear inside subscript brackets.
 *
 * @public
 */
export type SubscriptElementNode = SliceNode | ComparisonNode | ExistenceNode | ExprNode

/**
 * Represents a comparison operation for filtering array/object elements.
 *
 * @public
 */
export type ComparisonNode = {
  type: 'Comparison'
  left: ExprNode
  operator: '==' | '!=' | '>' | '<' | '>=' | '<='
  right: ExprNode
}

/**
 * Represents an existence check (?) for filtering elements that have a specific property.
 *
 * @public
 */
export type ExistenceNode = {
  type: 'Existence'
  base: PathNode
}

/**
 * Represents an array slice operation.
 *
 * @public
 */
export type SliceNode = {type: 'Slice'; start?: number; end?: number}

/**
 * Represents an identifier (property name) in the JSONMatch AST.
 *
 * @public
 */
export type IdentifierNode = {type: 'Identifier'; name: string}

/**
 * Represents a string literal in the JSONMatch AST.
 *
 * @public
 */
export type StringNode = {type: 'String'; value: string}

/**
 * Represents a numeric literal in the JSONMatch AST or an index depending on
 * execution the context.
 *
 * @public
 */
export type NumberNode = {type: 'Number'; value: number}

/**
 * Represents a boolean literal in the JSONMatch AST.
 *
 * @public
 */
export type BooleanNode = {type: 'Boolean'; value: boolean}

/**
 * Represents a null literal in the JSONMatch AST.
 *
 * @public
 */
export type NullNode = {type: 'Null'}

/**
 * Represents a wildcard (*) operation in the JSONMatch AST.
 *
 * @public
 */
export type WildcardNode = {type: 'Wildcard'}

/**
 * Represents the current context (`@`/`$`) in the JSONMatch AST.
 *
 * @public
 */
export type ThisNode = {type: 'This'}

class UnexpectedTokenError extends SyntaxError {
  constructor(token: Token, expected?: string) {
    super(
      expected
        ? `Expected ${expected} at position ${token.position} but got ${token.type} instead`
        : `Unexpected token ${token.type} at position ${token.position}`,
    )
  }
}

interface TokenCursor extends Cursor<Token, Token['type']> {
  consume<TTokenType extends Token['type']>(
    tokenType?: TTokenType,
  ): Extract<Token, {type: TTokenType}>
}

/**
 * Parses a JSONMatch expression string into an Abstract Syntax Tree (AST).
 *
 * This is the main parsing function that converts a JSONMatch string expression
 * into a structured AST that can be evaluated by the `jsonMatch` function or
 * manipulated using the path utilities.
 *
 * @param query - The JSONMatch expression string to parse
 * @returns The parsed AST representation of the expression
 *
 * @example
 * Basic parsing:
 * ```typescript
 * import { parse } from 'jsonmatch'
 *
 * const ast = parse('users[age > 21].name')
 * console.log(ast.type) // 'Path'
 * ```
 *
 * @example
 * Parsing with complex expressions:
 * ```typescript
 * const complexAst = parse('data..items[price > 100, category == "electronics"].name')
 * // Returns a nested PathNode structure
 * ```
 *
 * @public
 */
export function parse(query: string): ExprNode {
  const tokens = tokenize(query)
  if (tokens.length <= 1) throw new SyntaxError('Empty expression')
  const eof = tokens.at(-1)!

  // last token will always be EOF but we'll check anyway for the type assertion
  if (eof.type !== 'EOF') {
    throw new UnexpectedTokenError(eof)
  }

  const cursor = createCursor({
    values: tokens,
    fallback: eof,
    validator: (expectedTokenType: Token['type'], token) => {
      if (token.type !== expectedTokenType) {
        throw new UnexpectedTokenError(token, expectedTokenType)
      }
    },
  }) as TokenCursor
  const ast = parseExpression(cursor)

  cursor.consume('EOF')

  return ast
}

function parseExpression(cursor: TokenCursor): ExprNode {
  switch (cursor().type) {
    // Path openers
    case 'This':
    case 'Identifier':
    case '*':
    case '[':
    case '.':
    case '..': {
      return parsePath(cursor)
    }

    case 'String': {
      const {value} = cursor.consume('String')
      return {type: 'String', value}
    }

    case 'Number': {
      const {value} = cursor.consume('Number')
      return {type: 'Number', value}
    }

    case 'Boolean': {
      const {value} = cursor.consume('Boolean')
      return {type: 'Boolean', value}
    }

    case 'Null': {
      cursor.consume('Null')
      return {type: 'Null'}
    }

    default: {
      throw new UnexpectedTokenError(cursor())
    }
  }
}

function parsePath(cursor: TokenCursor): PathNode {
  // build up the path node in this variable the AST includes a `base` to allow
  // for chaining. this was done to prioritize evaluation of the AST so that the
  // base can be evaluated first
  let result: PathNode

  // handle implicit this
  if (cursor().type === '.' || cursor().type === '..') {
    const recursive = cursor().type === '..'
    cursor.consume()

    // Check if there's a segment following the dot(s)
    if (cursor().type === 'EOF' || cursor().type === ']' || cursor().type === ',') {
      // Only bare .. is valid - treat as wildcard. Bare . should be invalid
      if (recursive) {
        result = {
          type: 'Path',
          base: {
            type: 'Path',
            segment: {type: 'This'},
          },
          recursive,
          segment: {type: 'Wildcard'},
        }
      } else {
        // Bare . is invalid
        throw new UnexpectedTokenError(cursor(), 'Path Segment')
      }
    } else {
      // For implicit root, we need to parse the next segment and combine it
      const segment = parsePathSegment(cursor)
      result = {
        type: 'Path',
        base: {
          type: 'Path',
          segment: {type: 'This'},
        },
        recursive,
        segment,
      }
    }
  } else {
    // parse the initial segment
    const segment = parsePathSegment(cursor)
    result = {type: 'Path', segment}
  }

  // handle chaining: subscripts and dot notation can be mixed
  while (true) {
    // check for subscripts after identifiers, wildcards, or this
    if (cursor().type === '[') {
      const subscript = parseSubscript(cursor)
      result = {
        type: 'Path',
        base: result,
        recursive: false,
        segment: subscript,
      }
      continue
    }

    // check for dot notation continuation
    if (cursor().type === '.' || cursor().type === '..') {
      const recursive = cursor().type === '..'
      cursor.consume()
      const segment = parsePathSegment(cursor)
      result = {
        type: 'Path',
        base: result,
        recursive,
        segment,
      }
      continue
    }

    // no more chaining
    break
  }

  return result
}

function parsePathSegment(cursor: TokenCursor): SegmentNode {
  // PathSegment ::= This | Identifier | Wildcard | Subscript
  const next = cursor()

  if (next.type === 'This') {
    cursor.consume()
    return {type: 'This'}
  }

  if (next.type === 'Identifier') {
    cursor.consume()
    return {type: 'Identifier', name: next.value}
  }

  if (next.type === '*') {
    cursor.consume()
    return {type: 'Wildcard'}
  }

  if (next.type === '[') {
    return parseSubscript(cursor)
  }

  throw new UnexpectedTokenError(next, 'Path Segment')
}

function parseSubscript(cursor: TokenCursor): SubscriptNode {
  // Subscript ::= '[' SubscriptContent ']'
  const elements: SubscriptElementNode[] = []

  cursor.consume('[')
  elements.push(parseSubscriptElement(cursor))
  while (cursor().type === ',') {
    cursor.consume()
    elements.push(parseSubscriptElement(cursor))
  }
  cursor.consume(']')

  return {type: 'Subscript', elements}
}

function parseSubscriptElement(cursor: TokenCursor): SubscriptElementNode {
  if (cursor().type === ':' || cursor().type === 'Number') {
    return parseIndexOrSlice(cursor)
  }

  const nestedExpression = parseExpression(cursor)

  if (cursor().type === 'Operator') {
    const {value: operator} = cursor.consume('Operator')
    return {
      type: 'Comparison',
      left: nestedExpression,
      operator,
      right: parseExpression(cursor),
    }
  }

  if (cursor().type === '?' && nestedExpression.type === 'Path') {
    cursor.consume()
    return {
      type: 'Existence',
      base: nestedExpression,
    }
  }

  return nestedExpression
}

function parseIndexOrSlice(cursor: TokenCursor): SliceNode | NumberNode | PathNode {
  if (cursor().type === 'Number') {
    const {value: start} = cursor.consume('Number')

    if (cursor().type === ':') {
      cursor.consume()

      if (cursor().type === 'Number') {
        const {value: end} = cursor.consume('Number')
        return {type: 'Slice', start, end}
      }

      return {type: 'Slice', start}
    }

    return {type: 'Number', value: start}
  }

  if (cursor().type === ':') {
    cursor.consume()

    if (cursor().type === 'Number') {
      const {value: end} = cursor.consume('Number')
      return {type: 'Slice', end}
    }

    // bare `:` is parsed as a wildcard
    return {type: 'Path', segment: {type: 'Wildcard'}}
  }

  throw new UnexpectedTokenError(cursor(), 'Number or Slice')
}
