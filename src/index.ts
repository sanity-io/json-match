export {jsonMatch, type MatchEntry} from './match'
export {
  type ComparisonNode,
  type ExistenceNode,
  type ExprNode,
  type IdentifierNode,
  type NumberNode,
  type PathNode,
  type SegmentNode,
  type SliceNode,
  type StringNode,
  type SubscriptElementNode,
  type SubscriptNode,
  type ThisNode,
  type WildcardNode,
  type BooleanNode,
  type NullNode,
} from './parse'

export {
  getIndexForKey,
  parsePath,
  slicePath,
  stringifyPath,
  getPathDepth,
  joinPaths,
  type SingleValuePath,
  type Path,
  type PathSegment,
} from './path'
