interface CursorOptions<T, TExpected> {
  values: ArrayLike<T>
  fallback: T
  validator: (expected: TExpected, value: T, position: number) => void
}

export interface Cursor<T, TExpected> {
  (offset?: number): T
  position: number
  hasNext(): boolean
  consume: (expected?: TExpected) => T
}

export function createCursor<T, TExpected>({
  values,
  fallback,
  validator: validate,
}: CursorOptions<T, TExpected>): Cursor<T, TExpected> {
  let position = 0

  function peek(offset = 0) {
    return values[position + offset] ?? fallback
  }

  function consume(expected?: TExpected) {
    const current = peek()
    if (typeof expected !== 'undefined') {
      validate(expected, current, position)
    }
    position++
    return current
  }

  function hasNext() {
    return position < values.length
  }

  Object.defineProperty(peek, 'position', {get: () => position})
  return Object.assign(peek, {hasNext, consume}) as Cursor<T, TExpected>
}
