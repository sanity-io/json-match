import {describe, test, expect, vi} from 'vitest'
import {createCursor} from './cursor'

describe('Cursor', () => {
  test('creates cursor with basic peek functionality', () => {
    const cursor = createCursor({
      values: ['a', 'b', 'c'],
      fallback: '',
      validator: () => {},
    })

    expect(cursor()).toBe('a')
    expect(cursor(0)).toBe('a')
    expect(cursor(1)).toBe('b')
    expect(cursor(2)).toBe('c')
  })

  test('returns fallback for out of bounds access', () => {
    const cursor = createCursor({
      values: ['a', 'b'],
      fallback: 'fallback',
      validator: () => {},
    })

    expect(cursor(2)).toBe('fallback')
    expect(cursor(10)).toBe('fallback')
    expect(cursor(-1)).toBe('fallback')
  })

  test('tracks position correctly', () => {
    const cursor = createCursor({
      values: ['a', 'b', 'c'],
      fallback: '',
      validator: () => {},
    })

    expect(cursor.position).toBe(0)
    cursor.consume()
    expect(cursor.position).toBe(1)
    cursor.consume()
    expect(cursor.position).toBe(2)
  })

  test('hasNext works correctly', () => {
    const cursor = createCursor({
      values: ['a', 'b'],
      fallback: '',
      validator: () => {},
    })

    expect(cursor.hasNext()).toBe(true)
    cursor.consume()
    expect(cursor.hasNext()).toBe(true)
    cursor.consume()
    expect(cursor.hasNext()).toBe(false)
  })

  test('consume advances position and returns value', () => {
    const cursor = createCursor({
      values: ['a', 'b', 'c'],
      fallback: '',
      validator: () => {},
    })

    expect(cursor.consume()).toBe('a')
    expect(cursor.position).toBe(1)
    expect(cursor.consume()).toBe('b')
    expect(cursor.position).toBe(2)
  })

  test('consume returns fallback when beyond end', () => {
    const cursor = createCursor({
      values: ['a'],
      fallback: 'end',
      validator: () => {},
    })

    cursor.consume() // consume 'a'
    expect(cursor.consume()).toBe('end')
    expect(cursor.consume()).toBe('end')
  })

  test('validates on consume when expected value provided', () => {
    const mockValidator = vi.fn()
    const cursor = createCursor({
      values: ['a', 'b'],
      fallback: '',
      validator: mockValidator,
    })

    cursor.consume('a')
    expect(mockValidator).toHaveBeenCalledWith('a', 'a', 0)

    cursor.consume('b')
    expect(mockValidator).toHaveBeenCalledWith('b', 'b', 1)
  })

  test('does not validate when no expected value provided', () => {
    const mockValidator = vi.fn()
    const cursor = createCursor({
      values: ['a', 'b'],
      fallback: '',
      validator: mockValidator,
    })

    cursor.consume()
    cursor.consume()
    expect(mockValidator).not.toHaveBeenCalled()
  })

  test('validation throws error on mismatch', () => {
    const cursor = createCursor({
      values: ['a', 'b'],
      fallback: '',
      validator: (expected, actual, position) => {
        if (expected !== actual) {
          throw new Error(`Expected ${expected} but got ${actual} at ${position}`)
        }
      },
    })

    expect(() => cursor.consume('x')).toThrow('Expected x but got a at 0')
  })

  test('works with empty array', () => {
    const cursor = createCursor({
      values: [],
      fallback: 'empty',
      validator: () => {},
    })

    expect(cursor()).toBe('empty')
    expect(cursor.position).toBe(0)
    expect(cursor.hasNext()).toBe(false)
    expect(cursor.consume()).toBe('empty')
  })

  test('works with number arrays', () => {
    const cursor = createCursor({
      values: [1, 2, 3],
      fallback: 0,
      validator: () => {},
    })

    expect(cursor()).toBe(1)
    expect(cursor(1)).toBe(2)
    expect(cursor.consume()).toBe(1)
    expect(cursor()).toBe(2)
  })
})
