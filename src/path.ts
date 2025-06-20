const KEY_PREFIX = 'key:';
const FIELD_PREFIX = 'field:';
const INDEX_PREFIX = 'index:';

type PathKey = `${
  | typeof INDEX_PREFIX
  | typeof KEY_PREFIX
  | typeof FIELD_PREFIX}${string}`;

type PathMap = Map<PathKey, PathMap | true>;

export type PathSegment = string | number | { _key: string };
export type Path = PathSegment[];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isKeyedObject(value: unknown): value is { _key: string } {
  return isRecord(value) && typeof (value as any)._key === 'string';
}

export interface PathSet {
  add(path: Path): void;
  has(path: Path): boolean;
}

export function createPathSet(): PathSet {
  const root: PathMap = new Map();

  function getKey(segment: PathSegment): PathKey {
    if (isKeyedObject(segment)) return `${KEY_PREFIX}${segment._key}`;
    if (typeof segment === 'string') return `${FIELD_PREFIX}${segment}`;
    return `${INDEX_PREFIX}${segment}`;
  }

  function add(map: PathMap, [head, ...tail]: Path): void {
    if (typeof head === 'undefined') return;

    const key = getKey(head);
    if (!tail.length) {
      map.set(key, true);
      return;
    }

    const cached = map.get(key);
    if (typeof cached !== 'undefined') {
      if (cached === true) return;
      add(cached, tail);
      return;
    }

    const next = new Map<PathKey, PathMap | true>();
    map.set(key, next);
    add(next, tail);
  }

  function has(map: PathMap, [head, ...tail]: Path): boolean {
    if (typeof head === 'undefined') return false;
    const key = getKey(head);
    const cached = map.get(key);
    if (typeof cached === 'undefined') return false;
    if (!tail.length) return cached === true;
    if (cached === true) return false; // should not happen in practice
    return has(cached, tail);
  }

  return {
    add: (path: Path) => add(root, path),
    has: (path: Path) => has(root, path),
  };
}
