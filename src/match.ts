import { parse } from './parse';
import type {
  ComparisonNode,
  ExistenceNode,
  NumberNode,
  PathNode,
  SegmentNode,
  SubscriptNode,
  ExprNode,
} from './parse';
import { type Path, isKeyedObject, isRecord, createPathSet } from './path';

export interface MatchEntry {
  value: unknown;
  path: Path;
}

const itemEntry = (item: unknown, path: Path, index: number): MatchEntry => ({
  value: item,
  path: [...path, isKeyedObject(item) ? { _key: item._key } : index],
});

export interface MatchOptions {
  value: unknown;
  expression: PathNode | string;
}

export function* match({
  value,
  expression: expr,
}: MatchOptions): Generator<MatchEntry> {
  const visited = createPathSet();

  // Parse the expression if it's a string
  const parsedExpr = typeof expr === 'string' ? parse(expr) : expr;

  // Handle non-path expressions (literals)
  if (parsedExpr.type !== 'PathExpression') {
    // For number literals, treat as array index or object key
    if (parsedExpr.type === 'Number') {
      if (Array.isArray(value)) {
        const item = value.at(parsedExpr.value);
        if (typeof item !== 'undefined') {
          yield itemEntry(item, [], parsedExpr.value);
        }
        return;
      }
      if (value && typeof value === 'object' && parsedExpr.value in value) {
        const item = value[parsedExpr.value as keyof typeof value];
        if (typeof item !== 'undefined') {
          yield { value: item, path: [parsedExpr.value] };
        }
        return;
      }
      return;
    }

    // For string literals, treat as object key
    if (parsedExpr.type === 'String') {
      if (isRecord(value) && parsedExpr.value in value) {
        yield { value: value[parsedExpr.value], path: [parsedExpr.value] };
        return;
      }
      return;
    }

    return;
  }

  for (const entry of matchPathExpression({
    expr: parsedExpr,
    value,
    path: [],
  })) {
    const { path } = entry;
    if (visited.has(path)) continue;
    visited.add(path);
    yield entry;
  }
}

function* matchPathExpression({
  expr,
  value,
  path,
}: MatchEntry & { expr?: PathNode }): Generator<MatchEntry> {
  if (!expr) {
    yield { value, path };
    return;
  }

  // Get candidates from base context (left-recursive evaluation)
  const candidates = matchPathExpression({ expr: expr.base, value, path });

  for (const candidate of candidates) {
    if (expr.recursive) {
      // Check if this is bare '..' (just returns current value)
      if (expr.segment.type === 'Wildcard') {
        // For bare '..' return the root object only
        yield candidate;
        continue;
      }

      // Recursive descent - search through all nested values
      yield* recursiveMatch({ segment: expr.segment, ...candidate });
      continue;
    }

    yield* matchPathSegment({ segment: expr.segment, ...candidate });
  }
}

function* recursiveMatch({
  segment,
  value,
  path,
}: MatchEntry & { segment: SegmentNode }): Generator<MatchEntry> {
  // First try to match at current level
  yield* matchPathSegment({ segment, value, path });

  // Then recursively search nested values
  if (isRecord(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      yield* recursiveMatch({
        segment,
        value: nestedValue,
        path: [...path, key],
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    let index = 0;
    for (const item of value) {
      yield* recursiveMatch({ segment, ...itemEntry(item, path, index) });
      index++;
    }
  }
}

function* matchPathSegment({
  segment,
  value,
  path,
}: MatchEntry & { segment: SegmentNode }): Generator<MatchEntry> {
  switch (segment.type) {
    case 'This': {
      yield { value, path };
      return;
    }

    case 'Identifier': {
      if (!isRecord(value)) return;
      if (!(segment.name in value)) return;
      yield { value: value[segment.name], path: [...path, segment.name] };
      return;
    }

    case 'Subscript': {
      yield* matchSubscript({ subscript: segment, value, path });
      return;
    }

    case 'Wildcard': {
      if (Array.isArray(value)) {
        let index = 0;
        for (const item of value) {
          yield itemEntry(item, path, index);
          index++;
        }
        return;
      }

      if (isRecord(value)) {
        for (const [key, nestedValue] of Object.entries(value)) {
          yield { value: nestedValue, path: [...path, key] };
        }
        return;
      }

      return;
    }

    default: {
      return;
    }
  }
}

function* matchSubscript({
  value,
  subscript,
  path,
}: MatchEntry & { subscript: SubscriptNode }): Generator<MatchEntry> {
  // Process all subscript elements with union semantics (OR logic)
  for (const element of subscript.elements) {
    switch (element.type) {
      case 'Existence': {
        yield* matchExistence({ existence: element, value, path });
        continue;
      }

      case 'Comparison': {
        yield* matchComparison({ comparison: element, value, path });
        continue;
      }

      case 'PathExpression': {
        // All path-like elements in subscripts (wildcards, numbers, identifiers, etc.)
        yield* matchPathExpression({ expr: element, value, path });
        continue;
      }

      case 'Number': {
        // Handle number literals in subscripts (array indices)
        if (Array.isArray(value)) {
          const item = value.at(element.value);
          if (typeof item !== 'undefined') {
            yield itemEntry(item, path, element.value);
          }
        } else if (
          value &&
          typeof value === 'object' &&
          element.value in value
        ) {
          const item = value[element.value as keyof typeof value];
          if (typeof item !== 'undefined') {
            yield { value: item, path: [...path, element.value] };
          }
        }
        continue;
      }

      case 'String': {
        // Handle string literals in subscripts (object keys)
        if (isRecord(value) && element.value in value) {
          yield { value: value[element.value], path: [...path, element.value] };
        }
        continue;
      }

      case 'Slice': {
        if (!Array.isArray(value)) continue;
        let index = element.start ?? 0;

        for (const item of value.slice(element.start, element.end)) {
          yield itemEntry(item, path, index);
          index++;
        }
        continue;
      }

      default: {
        continue;
      }
    }
  }
}

function* matchExistence({
  existence: existence,
  value,
  path,
}: MatchEntry & { existence: ExistenceNode }) {
  if (Array.isArray(value)) {
    let index = 0;
    for (const item of value) {
      const first = matchPathExpression({
        expr: existence.base,
        ...itemEntry(item, path, index),
      }).next();

      // yield if the above match didn't immediately complete signifying that there was a match
      if (!first.done) {
        yield itemEntry(item, path, index);
      }

      index++;
    }
    return;
  }

  const first = matchPathExpression({
    expr: existence.base,
    path,
    value,
  }).next();

  if (!first.done) {
    yield { value, path };
  }
}

function* matchComparison({
  comparison,
  value,
  path,
}: MatchEntry & { comparison: ComparisonNode }): Generator<MatchEntry> {
  if (Array.isArray(value)) {
    // Apply constraint to array items
    let index = 0;
    for (const item of value) {
      if (evaluateComparison(comparison, item)) {
        yield itemEntry(item, path, index);
      }
      index++;
    }
    return;
  }

  // Apply constraint to individual value (for chained constraints)
  if (evaluateComparison(comparison, value)) {
    yield { value, path };
  }
}

function evaluateComparison(
  comparison: ComparisonNode,
  contextValue: unknown,
): boolean {
  const leftValue = evaluateOperand(comparison.left, contextValue);
  const rightValue = evaluateOperand(comparison.right, contextValue);

  switch (comparison.operator) {
    case '==':
      return leftValue === rightValue;
    case '!=':
      return leftValue !== rightValue;
    case '>':
      return (
        typeof leftValue === 'number' &&
        typeof rightValue === 'number' &&
        leftValue > rightValue
      );
    case '<':
      return (
        typeof leftValue === 'number' &&
        typeof rightValue === 'number' &&
        leftValue < rightValue
      );
    case '>=':
      return (
        typeof leftValue === 'number' &&
        typeof rightValue === 'number' &&
        leftValue >= rightValue
      );
    case '<=':
      return (
        typeof leftValue === 'number' &&
        typeof rightValue === 'number' &&
        leftValue <= rightValue
      );
    default:
      return false;
  }
}

function evaluateOperand(operand: any, contextValue: unknown): unknown {
  switch (operand.type) {
    case 'String':
      return operand.value;
    case 'Number':
      return operand.value;
    case 'PathExpression':
      // Handle context references with special identifiers
      if (!operand.base && operand.segment?.type === 'Identifier') {
        const name = operand.segment.name;
        if (name === '@' || name === '$') {
          // @ and $ both refer to the current item context
          return contextValue;
        }
      }

      // Check if this is a literal value wrapped in PathExpression
      if (!operand.base && operand.segment) {
        switch (operand.segment.type) {
          case 'Number':
            return operand.segment.value;
          case 'String':
            return operand.segment.value;
          case 'This':
            return contextValue;
          default:
            // For other path expressions, evaluate against the context
            const matches = Array.from(
              matchPathExpression({
                expr: operand,
                value: contextValue,
                path: [],
              }),
            );
            return matches.length === 1
              ? matches[0].value
              : matches.map((m) => m.value);
        }
      }
      // For complex path expressions, evaluate against the context
      const matches = Array.from(
        matchPathExpression({
          expr: operand,
          value: contextValue,
          path: [],
        }),
      );
      return matches.length === 1
        ? matches[0].value
        : matches.map((m) => m.value);
    default:
      return undefined;
  }
}
