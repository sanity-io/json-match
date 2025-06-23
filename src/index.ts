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
} from './parse'
export {stringifyPath} from './stringify'
export {
  getIndexForKey,
  getParentPath,
  addPathSegment,
  parsePath,
  type CompatPath,
  type Path,
  type PathSegment,
} from './path'
