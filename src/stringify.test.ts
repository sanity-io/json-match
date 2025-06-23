import {describe, test, expect} from 'vitest'
import {parse} from './parse'
import {stringifyPath} from './stringify'

describe('stringify', () => {
  // Helper function to test round-trip: string -> AST -> string
  function testRoundTrip(expression: string, expectedOutput?: string) {
    const ast = parse(expression)
    const stringified = stringifyPath(ast)
    const expected = expectedOutput || expression
    expect(stringified).toBe(expected)

    // Verify it can be parsed again (round-trip test)
    const reparsed = parse(stringified)
    expect(reparsed).toEqual(ast)
  }

  describe('Literal Expressions', () => {
    test('stringifies boolean literals', () => {
      expect(stringifyPath(parse('true'))).toBe('true')
      expect(stringifyPath(parse('false'))).toBe('false')
    })

    test('stringifies boolean literals in expressions', () => {
      expect(stringifyPath(parse('items[active == true]'))).toBe('items[active==true]')
      expect(stringifyPath(parse('items[visible != false]'))).toBe('items[visible!=false]')
    })

    test('stringifies mixed boolean and other literals', () => {
      expect(stringifyPath(parse('[true, false, "text", 42]'))).toBe('[true,false,"text",42]')
    })
  })

  describe('Basic Expressions', () => {
    test('stringifies number literals', () => {
      testRoundTrip('42')
      testRoundTrip('-17')
      testRoundTrip('3.14')
      testRoundTrip('-99.9')
    })

    test('stringifies string literals', () => {
      testRoundTrip('"hello"')
      testRoundTrip('"escaped \\"quotes\\""')
      testRoundTrip('"backslash \\\\ slash"')
      testRoundTrip('"unicode \\u00E5 test"', '"unicode å test"')
    })

    test('stringifies simple identifiers', () => {
      testRoundTrip('name')
      testRoundTrip('user_name')
      testRoundTrip('$variable')
      testRoundTrip('_private')
    })

    test('stringifies context references', () => {
      testRoundTrip('@')
      testRoundTrip('$', '@')
    })

    test('stringifies wildcards', () => {
      testRoundTrip('*')
    })
  })

  describe('Path Expressions', () => {
    test('stringifies dot notation', () => {
      testRoundTrip('user.name')
      testRoundTrip('data.items.metadata')
      testRoundTrip('config.server.port')
    })

    test('stringifies recursive descent', () => {
      testRoundTrip('data..name')
      testRoundTrip('root..items.price')
      testRoundTrip('..shortName', '@..shortName')
    })

    test('stringifies implicit root access', () => {
      testRoundTrip('.bicycle', '@.bicycle')
      testRoundTrip('.user.profile', '@.user.profile')
      testRoundTrip('..price', '@..price')
      testRoundTrip('..', '@..*')
    })
  })

  describe('Array Access', () => {
    test('stringifies array indices', () => {
      testRoundTrip('items[0]')
      testRoundTrip('users[-1]')
      testRoundTrip('data[42]')
    })

    test('stringifies array slices', () => {
      testRoundTrip('items[1:4]')
      testRoundTrip('users[2:]', 'users[2:]')
      testRoundTrip('data[:3]', 'data[:3]')
      testRoundTrip('all[:]', 'all[*]')
    })

    test('stringifies wildcards in brackets', () => {
      testRoundTrip('items[*]')
      testRoundTrip('users[*].name')
    })

    test('stringifies multiple indices', () => {
      testRoundTrip('items[0,2,4]')
      testRoundTrip('data[1,3,5,7]')
    })

    test('stringifies mixed subscript content', () => {
      testRoundTrip('items[0,2:4,*]')
      testRoundTrip('data[1:3,5,7:9]')
    })
  })

  describe('Constraints', () => {
    test('stringifies comparison constraints', () => {
      testRoundTrip('users[age>21]')
      testRoundTrip('products[price<=100]')
      testRoundTrip('items[status=="active"]')
      testRoundTrip('numbers[@!=0]')
    })

    test('stringifies existence constraints', () => {
      testRoundTrip('users[email?]')
      testRoundTrip('items[metadata.tags?]')
      testRoundTrip('products[category?]')
    })

    test('stringifies multiple constraints', () => {
      testRoundTrip('users[age>65,age<18]')
      testRoundTrip('items[type=="book",price<50]')
      testRoundTrip('friends[age>35,favoriteColor=="blue"]')
    })

    test('stringifies context references in constraints', () => {
      testRoundTrip('[@>10]')
      testRoundTrip('[$<=5]', '[@<=5]')
      testRoundTrip('[@==$]', '[@==@]')
    })
  })

  describe('Quoted Identifiers', () => {
    test('quotes identifiers that need quoting', () => {
      const ast = parse("'field-name'")
      expect(stringifyPath(ast)).toBe("'field-name'")
    })

    test('does not quote simple identifiers', () => {
      const ast = parse('simpleField')
      expect(stringifyPath(ast)).toBe('simpleField')
    })

    test('handles escaped quotes in identifiers', () => {
      testRoundTrip("'escaped \\'quotes\\''")
      testRoundTrip('\'mixed "quotes"\'')
    })

    test('handles special characters in identifiers', () => {
      testRoundTrip("'special-chars'")
      testRoundTrip("'unicode-\\u00E5'", "'unicode-å'")
      testRoundTrip("'control\\nchars'", "'control\\nchars'")
    })
  })

  describe('Complex Expressions', () => {
    test('stringifies complex nested expressions', () => {
      testRoundTrip('data.items[*].tags[0]')
      testRoundTrip('users[age>21].profile.email')
      testRoundTrip('products[category=="electronics"][price>100].name')
    })

    test('stringifies expressions with mixed access patterns', () => {
      testRoundTrip('matrix[1][2]')
      testRoundTrip('data.items[*][0]')
      testRoundTrip('users[*].addresses[0].city')
    })

    test('stringifies real-world examples', () => {
      testRoundTrip('friends[age>35,favoriteColor=="blue"]')
      testRoundTrip('products[1:3,price>500]')
      testRoundTrip('[zargh,blagh,fnargh[1,2,3]]')
      testRoundTrip('.bicycle.*', '@.bicycle.*')
    })
  })

  describe('Edge Cases', () => {
    test('handles numeric edge cases', () => {
      testRoundTrip('0')
      testRoundTrip('3.0', '3')
    })

    test('handles string escaping edge cases', () => {
      testRoundTrip('"\\b\\f\\n\\r\\t"')
      testRoundTrip('"\\u0000\\u001F"', '"\\u0000\\u001f"')
      testRoundTrip('"\\\\"')
    })
  })

  describe('Error Cases', () => {
    test('throws on unknown node types', () => {
      const invalidNode = {type: 'InvalidType'} as any
      expect(() => stringifyPath(invalidNode)).toThrow('Unknown node type: InvalidType')
    })
  })
})
