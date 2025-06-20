import { tokenize, type Token } from './tokenize';
import { createCursor, Cursor } from './cursor';

// match({value: [1,2,3,4,5], expr: '1:3'})

export type ExprNode = NumberNode | StringNode | PathNode;

export type PathNode = {
  type: 'PathExpression';
  base?: PathNode; // the preceding context (what we apply the current segment to)
  recursive?: boolean; // true for '..' recursive descent, false/undefined for normal '.' descent
  segment: SegmentNode; // current operation to apply
};

export type SegmentNode =
  | ThisNode
  | IdentifierNode
  | WildcardNode
  | SubscriptNode;

export type SubscriptNode = {
  type: 'Subscript';
  elements: SubscriptElementNode[];
};

export type SubscriptElementNode =
  | SliceNode
  | ComparisonNode
  | ExistenceNode
  | ExprNode;

export type ComparisonNode = {
  type: 'Comparison';
  left: ExprNode;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  right: ExprNode;
};

export type ExistenceNode = {
  type: 'Existence';
  base: PathNode;
};

export type SliceNode = { type: 'Slice'; start?: number; end?: number };
export type IdentifierNode = { type: 'Identifier'; name: string };
export type StringNode = { type: 'String'; value: string };
export type NumberNode = { type: 'Number'; value: number };
export type WildcardNode = { type: 'Wildcard' };
export type ThisNode = { type: 'This' };

class UnexpectedTokenError extends SyntaxError {
  constructor(token: Token, expected?: string) {
    super(
      expected
        ? `Expected ${expected} at position ${token.position} but got ${token.type} instead`
        : `Unexpected token ${token.type} at position ${token.position}`,
    );
  }
}

interface TokenCursor extends Cursor<Token, Token['type']> {
  consume<TTokenType extends Token['type']>(
    tokenType?: TTokenType,
  ): Extract<Token, { type: TTokenType }>;
}

// Main parse function
export function parse(query: string): ExprNode {
  const tokens = tokenize(query);
  if (tokens.length <= 1) throw new SyntaxError('Empty expression');
  const eof = tokens.at(-1)!;

  // last token will always be EOF but we'll check anyway for the type assertion
  if (eof.type !== 'EOF') {
    throw new UnexpectedTokenError(eof);
  }

  const cursor = createCursor({
    values: tokens,
    fallback: eof,
    validator: (expectedTokenType: Token['type'], token) => {
      if (token.type !== expectedTokenType) {
        throw new UnexpectedTokenError(token, expectedTokenType);
      }
    },
  }) as TokenCursor;
  const ast = parseExpression(cursor);

  cursor.consume('EOF');

  return ast;
}

const PATH_OPENERS = new Set<Token['type']>([
  'This',
  'Identifier',
  '*',
  '[',
  '.',
  '..',
]);

function parseExpression(cursor: TokenCursor): ExprNode {
  switch (cursor().type) {
    // Path openers
    case 'This':
    case 'Identifier':
    case '*':
    case '[':
    case '.':
    case '..': {
      return parsePath(cursor);
    }

    case 'String': {
      const { value } = cursor.consume('String');
      return { type: 'String', value };
    }

    case 'Number': {
      const { value } = cursor.consume('Number');
      return { type: 'Number', value };
    }

    default: {
      throw new UnexpectedTokenError(cursor());
    }
  }
}

function parsePath(cursor: TokenCursor): PathNode {
  // build up the path node in this variable the AST includes a `base` to allow
  // for chaining. this was done to prioritize evaluation of the AST so that the
  // base can be matched first
  let result: PathNode;

  // handle implicit this
  if (cursor().type === '.' || cursor().type === '..') {
    const recursive = cursor().type === '..';
    cursor.consume();

    // Check if there's a segment following the dot(s)
    if (
      cursor().type === 'EOF' ||
      cursor().type === ']' ||
      cursor().type === ','
    ) {
      // Only bare .. is valid - treat as wildcard. Bare . should be invalid
      if (recursive) {
        result = {
          type: 'PathExpression',
          base: {
            type: 'PathExpression',
            segment: { type: 'This' },
          },
          recursive,
          segment: { type: 'Wildcard' },
        };
      } else {
        // Bare . is invalid
        throw new UnexpectedTokenError(cursor(), 'Path Segment');
      }
    } else {
      // For implicit root, we need to parse the next segment and combine it
      const segment = parsePathSegment(cursor);
      result = {
        type: 'PathExpression',
        base: {
          type: 'PathExpression',
          segment: { type: 'This' },
        },
        recursive,
        segment,
      };
    }
  } else {
    // parse the initial segment
    const segment = parsePathSegment(cursor);
    result = { type: 'PathExpression', segment };
  }

  // handle chaining: subscripts and dot notation can be mixed
  while (true) {
    // check for subscripts after identifiers, wildcards, or this
    if (cursor().type === '[') {
      const subscript = parseSubscript(cursor);
      result = {
        type: 'PathExpression',
        base: result,
        recursive: false,
        segment: subscript,
      };
      continue;
    }

    // check for dot notation continuation
    if (cursor().type === '.' || cursor().type === '..') {
      const recursive = cursor().type === '..';
      cursor.consume();
      const segment = parsePathSegment(cursor);
      result = {
        type: 'PathExpression',
        base: result,
        recursive,
        segment,
      };
      continue;
    }

    // no more chaining
    break;
  }

  return result;
}

function parsePathSegment(cursor: TokenCursor): SegmentNode {
  // PathSegment ::= This | Identifier | Wildcard | Subscript
  const next = cursor();

  if (next.type === 'This') {
    cursor.consume();
    return { type: 'This' };
  }

  if (next.type === 'Identifier') {
    cursor.consume();
    return { type: 'Identifier', name: next.value };
  }

  if (next.type === '*') {
    cursor.consume();
    return { type: 'Wildcard' };
  }

  if (next.type === '[') {
    return parseSubscript(cursor);
  }

  throw new UnexpectedTokenError(next, 'Path Segment');
}

function parseSubscript(cursor: TokenCursor): SubscriptNode {
  // Subscript ::= '[' SubscriptContent ']'
  const elements: SubscriptElementNode[] = [];

  cursor.consume('[');
  elements.push(parseSubscriptElement(cursor));
  while (cursor().type === ',') {
    cursor.consume();
    elements.push(parseSubscriptElement(cursor));
  }
  cursor.consume(']');

  return { type: 'Subscript', elements };
}

function parseSubscriptElement(cursor: TokenCursor): SubscriptElementNode {
  if (cursor().type === ':' || cursor().type === 'Number') {
    return parseIndexOrSlice(cursor);
  }

  const nestedExpression = parseExpression(cursor);

  if (cursor().type === 'Operator') {
    const { value: operator } = cursor.consume('Operator');
    return {
      type: 'Comparison',
      left: nestedExpression,
      operator,
      right: parseExpression(cursor),
    };
  }

  if (cursor().type === '?' && nestedExpression.type === 'PathExpression') {
    cursor.consume();
    return {
      type: 'Existence',
      base: nestedExpression,
    };
  }

  return nestedExpression;
}

function parseIndexOrSlice(
  cursor: TokenCursor,
): SliceNode | NumberNode | PathNode {
  if (cursor().type === 'Number') {
    const { value: start } = cursor.consume('Number');

    if (cursor().type === ':') {
      cursor.consume();

      if (cursor().type === 'Number') {
        const { value: end } = cursor.consume('Number');
        return { type: 'Slice', start, end };
      }

      return { type: 'Slice', start };
    }

    return { type: 'Number', value: start };
  }

  if (cursor().type === ':') {
    cursor.consume();

    if (cursor().type === 'Number') {
      const { value: end } = cursor.consume('Number');
      return { type: 'Slice', end };
    }

    return { type: 'PathExpression', segment: { type: 'Wildcard' } };
  }

  throw new UnexpectedTokenError(cursor(), 'Number or Slice');
}
