import {describe, test, expect} from 'vitest'
import {tokenize} from './tokenize'

describe('Boolean Tokens', () => {
  test('parses true literal', () => {
    expect(tokenize('true')).toMatchObject([
      //
      {type: 'Boolean', value: true},
      {type: 'EOF'},
    ])
  })

  test('parses false literal', () => {
    expect(tokenize('false')).toMatchObject([
      //
      {type: 'Boolean', value: false},
      {type: 'EOF'},
    ])
  })

  test('parses boolean in expression context', () => {
    expect(tokenize('items[active == true]')).toMatchObject([
      {type: 'Identifier', value: 'items'},
      {type: '['},
      {type: 'Identifier', value: 'active'},
      {type: 'Operator', value: '=='},
      {type: 'Boolean', value: true},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('parses both boolean values in sequence', () => {
    expect(tokenize('[true, false]')).toMatchObject([
      {type: '['},
      {type: 'Boolean', value: true},
      {type: ','},
      {type: 'Boolean', value: false},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('distinguishes boolean from similar identifier', () => {
    expect(tokenize('truthy')).toMatchObject([{type: 'Identifier', value: 'truthy'}, {type: 'EOF'}])
  })

  test('distinguishes boolean from similar identifier with false', () => {
    expect(tokenize('falsey')).toMatchObject([{type: 'Identifier', value: 'falsey'}, {type: 'EOF'}])
  })
})

describe('Number Tokens', () => {
  test('parses positive integers', () => {
    expect(tokenize('42')).toMatchObject([
      //
      {type: 'Number', value: 42},
      {type: 'EOF'},
    ])
  })

  test('parses negative integers', () => {
    expect(tokenize('-17')).toMatchObject([
      //
      {type: 'Number', value: -17},
      {type: 'EOF'},
    ])
  })

  test('parses positive floats', () => {
    expect(tokenize('3.14')).toMatchObject([
      //
      {type: 'Number', value: 3.14},
      {type: 'EOF'},
    ])
  })

  test('parses negative floats', () => {
    expect(tokenize('-99.99')).toMatchObject([
      //
      {type: 'Number', value: -99.99},
      {type: 'EOF'},
    ])
  })

  test('parses zero', () => {
    expect(tokenize('0')).toMatchObject([
      //
      {type: 'Number', value: 0},
      {type: 'EOF'},
    ])
  })

  test('parses zero with decimal', () => {
    expect(tokenize('0.5')).toMatchObject([
      //
      {type: 'Number', value: 0.5},
      {type: 'EOF'},
    ])
  })
})

describe('String Literal Tokens', () => {
  test('parses simple string', () => {
    expect(tokenize('"hello"')).toMatchObject([
      //
      {type: 'String', value: 'hello'},
      {type: 'EOF'},
    ])
  })

  test('parses empty string', () => {
    expect(tokenize('""')).toMatchObject([
      //
      {type: 'String', value: ''},
      {type: 'EOF'},
    ])
  })

  test('parses string with escaped quotes', () => {
    expect(tokenize('"escaped \\"quotes\\""')).toMatchObject([
      {type: 'String', value: 'escaped "quotes"'},
      {type: 'EOF'},
    ])
  })

  test('parses string with escaped backslash', () => {
    expect(tokenize('"path\\\\to\\\\file"')).toMatchObject([
      {type: 'String', value: 'path\\to\\file'},
      {type: 'EOF'},
    ])
  })

  test('parses string with escaped forward slash', () => {
    expect(tokenize('"url\\/path"')).toMatchObject([
      {type: 'String', value: 'url/path'},
      {type: 'EOF'},
    ])
  })

  test('parses string with control characters', () => {
    expect(tokenize('"line1\\nline2\\tindented"')).toMatchObject([
      {type: 'String', value: 'line1\nline2\tindented'},
      {type: 'EOF'},
    ])
  })

  test('parses string with all control characters', () => {
    expect(tokenize('"\\b\\f\\n\\r\\t"')).toMatchObject([
      {type: 'String', value: '\b\f\n\r\t'},
      {type: 'EOF'},
    ])
  })

  test('parses string with Unicode escape', () => {
    expect(tokenize('"\\u00E5"')).toMatchObject([{type: 'String', value: 'å'}, {type: 'EOF'}])
  })

  test('parses string with Unicode surrogate pair', () => {
    expect(tokenize('"\\uD834\\uDD1E"')).toMatchObject([
      {type: 'String', value: '𝄞'},
      {type: 'EOF'},
    ])
  })

  test('parses string with Unicode adjacent to text', () => {
    expect(tokenize('"\\u00E5abc"')).toMatchObject([{type: 'String', value: 'åabc'}, {type: 'EOF'}])
  })

  test('throws on unterminated string', () => {
    expect(() => tokenize('"unterminated')).toThrow('Expected `"`')
  })

  test('throws on invalid escape sequence', () => {
    expect(() => tokenize('"invalid\\x"')).toThrow('Invalid escape sequence \\x at position 9')
  })

  test('throws on invalid Unicode escape', () => {
    expect(() => tokenize('"\\uXXXX"')).toThrow(
      'Expected character `X` at position 3 to match /[0-9a-fA-F]/',
    )
  })
})

describe('Identifier Tokens', () => {
  test('parses simple identifier', () => {
    expect(tokenize('name')).toMatchObject([{type: 'Identifier', value: 'name'}, {type: 'EOF'}])
  })

  test('parses identifier with numbers', () => {
    expect(tokenize('item123')).toMatchObject([
      {type: 'Identifier', value: 'item123'},
      {type: 'EOF'},
    ])
  })

  test('parses identifier with underscore and dollar', () => {
    expect(tokenize('_$valid_identifier$')).toMatchObject([
      {type: 'Identifier', value: '_$valid_identifier$'},
      {type: 'EOF'},
    ])
  })

  test('parses identifier that starts with dollar', () => {
    expect(tokenize('$valid')).toMatchObject([{type: 'Identifier', value: '$valid'}, {type: 'EOF'}])
  })

  test('parses quoted identifier', () => {
    expect(tokenize("'field-name'")).toMatchObject([
      {type: 'Identifier', value: 'field-name'},
      {type: 'EOF'},
    ])
  })

  test('parses quoted identifier with special characters', () => {
    expect(tokenize("'@type'")).toMatchObject([{type: 'Identifier', value: '@type'}, {type: 'EOF'}])
  })

  test('parses quoted identifier with escaped single quotes', () => {
    expect(tokenize("'can\\'t'")).toMatchObject([
      {type: 'Identifier', value: "can't"},
      {type: 'EOF'},
    ])
  })

  test('parses quoted identifier with mixed quotes', () => {
    expect(tokenize(`'has"quotes'`)).toMatchObject([
      {type: 'Identifier', value: 'has"quotes'},
      {type: 'EOF'},
    ])
  })

  test('parses quoted identifier with Unicode', () => {
    expect(tokenize("'field-\\u00E5'")).toMatchObject([
      {type: 'Identifier', value: 'field-å'},
      {type: 'EOF'},
    ])
  })

  test('throws on unterminated quoted identifier', () => {
    expect(() => tokenize("'unterminated")).toThrow("Expected `'`")
  })
})

describe('Operator Tokens', () => {
  test('parses equality operator', () => {
    expect(tokenize('==')).toMatchObject([
      //
      {type: 'Operator', value: '=='},
      {type: 'EOF'},
    ])
  })

  test('parses inequality operator', () => {
    expect(tokenize('!=')).toMatchObject([
      //
      {type: 'Operator', value: '!='},
      {type: 'EOF'},
    ])
  })

  test('parses greater than operator', () => {
    expect(tokenize('>')).toMatchObject([
      //
      {type: 'Operator', value: '>'},
      {type: 'EOF'},
    ])
  })

  test('parses less than operator', () => {
    expect(tokenize('<')).toMatchObject([
      //
      {type: 'Operator', value: '<'},
      {type: 'EOF'},
    ])
  })

  test('parses greater than or equal operator', () => {
    expect(tokenize('>=')).toMatchObject([
      //
      {type: 'Operator', value: '>='},
      {type: 'EOF'},
    ])
  })

  test('parses less than or equal operator', () => {
    expect(tokenize('<=')).toMatchObject([
      //
      {type: 'Operator', value: '<='},
      {type: 'EOF'},
    ])
  })
})

describe('Punctuation Tokens', () => {
  test('parses dot', () => {
    expect(tokenize('.')).toMatchObject([{type: '.'}, {type: 'EOF'}])
  })

  test('parses double dot', () => {
    expect(tokenize('..')).toMatchObject([{type: '..'}, {type: 'EOF'}])
  })

  test('parses left bracket', () => {
    expect(tokenize('[')).toMatchObject([{type: '['}, {type: 'EOF'}])
  })

  test('parses right bracket', () => {
    expect(tokenize(']')).toMatchObject([{type: ']'}, {type: 'EOF'}])
  })

  test('parses comma', () => {
    expect(tokenize(',')).toMatchObject([{type: ','}, {type: 'EOF'}])
  })

  test('parses colon', () => {
    expect(tokenize(':')).toMatchObject([{type: ':'}, {type: 'EOF'}])
  })

  test('parses question mark', () => {
    expect(tokenize('?')).toMatchObject([{type: '?'}, {type: 'EOF'}])
  })

  test('parses wildcard', () => {
    expect(tokenize('*')).toMatchObject([{type: '*'}, {type: 'EOF'}])
  })
})

describe('This Context Tokens', () => {
  test('parses dollar sign', () => {
    expect(tokenize('$')).toMatchObject([{type: 'This'}, {type: 'EOF'}])
  })

  test('parses at sign', () => {
    expect(tokenize('@')).toMatchObject([{type: 'This'}, {type: 'EOF'}])
  })
})

describe('Whitespace Handling', () => {
  test('skips spaces', () => {
    expect(tokenize(' name ')).toMatchObject([{type: 'Identifier', value: 'name'}, {type: 'EOF'}])
  })

  test('skips tabs and newlines', () => {
    expect(tokenize('\t\nname\r\n')).toMatchObject([
      {type: 'Identifier', value: 'name'},
      {type: 'EOF'},
    ])
  })

  test('handles whitespace between tokens', () => {
    expect(tokenize('name . field')).toMatchObject([
      {type: 'Identifier', value: 'name'},
      {type: '.'},
      {type: 'Identifier', value: 'field'},
      {type: 'EOF'},
    ])
  })
})

describe('Complex Expressions', () => {
  test('tokenizes simple property access', () => {
    expect(tokenize('user.name')).toMatchObject([
      {type: 'Identifier', value: 'user'},
      {type: '.'},
      {type: 'Identifier', value: 'name'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes array access with index', () => {
    expect(tokenize('items[0]')).toMatchObject([
      {type: 'Identifier', value: 'items'},
      {type: '['},
      {type: 'Number', value: 0},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes array slice', () => {
    expect(tokenize('items[1:3]')).toMatchObject([
      {type: 'Identifier', value: 'items'},
      {type: '['},
      {type: 'Number', value: 1},
      {type: ':'},
      {type: 'Number', value: 3},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes wildcard access', () => {
    expect(tokenize('items[*].name')).toMatchObject([
      {type: 'Identifier', value: 'items'},
      {type: '['},
      {type: '*'},
      {type: ']'},
      {type: '.'},
      {type: 'Identifier', value: 'name'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes constraint with comparison', () => {
    expect(tokenize('users[age > 21]')).toMatchObject([
      {type: 'Identifier', value: 'users'},
      {type: '['},
      {type: 'Identifier', value: 'age'},
      {type: 'Operator', value: '>'},
      {type: 'Number', value: 21},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes constraint with string literal', () => {
    expect(tokenize('items[status == "active"]')).toMatchObject([
      {type: 'Identifier', value: 'items'},
      {type: '['},
      {type: 'Identifier', value: 'status'},
      {type: 'Operator', value: '=='},
      {type: 'String', value: 'active'},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes existence constraint', () => {
    expect(tokenize('users[email?]')).toMatchObject([
      {type: 'Identifier', value: 'users'},
      {type: '['},
      {type: 'Identifier', value: 'email'},
      {type: '?'},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes implicit root access', () => {
    expect(tokenize('.bicycle.brand')).toMatchObject([
      {type: '.'},
      {type: 'Identifier', value: 'bicycle'},
      {type: '.'},
      {type: 'Identifier', value: 'brand'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes recursive descent', () => {
    expect(tokenize('data..name')).toMatchObject([
      {type: 'Identifier', value: 'data'},
      {type: '..'},
      {type: 'Identifier', value: 'name'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes bare recursive descent', () => {
    expect(tokenize('..')).toMatchObject([{type: '..'}, {type: 'EOF'}])
  })

  test('tokenizes expression union', () => {
    expect(tokenize('[name, email]')).toMatchObject([
      {type: '['},
      {type: 'Identifier', value: 'name'},
      {type: ','},
      {type: 'Identifier', value: 'email'},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes quoted identifier with special characters', () => {
    expect(tokenize("'user-data'['first-name']")).toMatchObject([
      {type: 'Identifier', value: 'user-data'},
      {type: '['},
      {type: 'Identifier', value: 'first-name'},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes item context comparison', () => {
    expect(tokenize('[@ > 10]')).toMatchObject([
      {type: '['},
      {type: 'This'},
      {type: 'Operator', value: '>'},
      {type: 'Number', value: 10},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes mixed subscript content', () => {
    expect(tokenize('products[1:3, price > 500]')).toMatchObject([
      {type: 'Identifier', value: 'products'},
      {type: '['},
      {type: 'Number', value: 1},
      {type: ':'},
      {type: 'Number', value: 3},
      {type: ','},
      {type: 'Identifier', value: 'price'},
      {type: 'Operator', value: '>'},
      {type: 'Number', value: 500},
      {type: ']'},
      {type: 'EOF'},
    ])
  })
})

describe('Edge Cases and Error Handling', () => {
  test('handles empty input', () => {
    expect(tokenize('')).toMatchObject([{type: 'EOF'}])
  })

  test('handles only whitespace', () => {
    expect(tokenize('   \t\n  ')).toMatchObject([{type: 'EOF'}])
  })

  test('throws on unexpected character', () => {
    expect(() => tokenize('#')).toThrow("Unexpected character '#' at position 0")
  })

  test('throws on invalid operator sequence', () => {
    expect(() => tokenize('=')).toThrow('Invalid operator at position 0')
  })

  test('throws on invalid operator sequence with !', () => {
    expect(() => tokenize('!')).toThrow('Invalid operator at position 0')
  })

  test('distinguishes negative numbers from operators', () => {
    expect(tokenize('age > -5')).toMatchObject([
      {type: 'Identifier', value: 'age'},
      {type: 'Operator', value: '>'},
      {type: 'Number', value: -5},
      {type: 'EOF'},
    ])
  })

  test('handles number followed by dot operator', () => {
    expect(tokenize('3.field')).toMatchObject([
      {type: 'Number', value: 3},
      {type: '.'},
      {type: 'Identifier', value: 'field'},
      {type: 'EOF'},
    ])
  })
})

describe('Position Tracking', () => {
  test('tracks token positions correctly', () => {
    const tokens = tokenize('name[0]')
    expect(tokens).toEqual([
      {type: 'Identifier', value: 'name', position: 0},
      {type: '[', position: 4},
      {type: 'Number', value: 0, position: 5},
      {type: ']', position: 6},
      {type: 'EOF', position: 7},
    ])
  })

  test('tracks positions with whitespace', () => {
    const tokens = tokenize('  name  [  0  ]  ')
    expect(tokens).toMatchObject([
      {type: 'Identifier', value: 'name', position: 2},
      {type: '[', position: 8},
      {type: 'Number', value: 0, position: 11},
      {type: ']', position: 14},
      {type: 'EOF', position: 17},
    ])
  })
})

describe('Real JSONMatch Examples from Spec', () => {
  test('tokenizes friends constraint example', () => {
    const result = tokenize('friends[age > 35, favoriteColor == "blue"]')
    expect(result).toMatchObject([
      {type: 'Identifier', value: 'friends'},
      {type: '['},
      {type: 'Identifier', value: 'age'},
      {type: 'Operator', value: '>'},
      {type: 'Number', value: 35},
      {type: ','},
      {type: 'Identifier', value: 'favoriteColor'},
      {type: 'Operator', value: '=='},
      {type: 'String', value: 'blue'},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes complex nested union example', () => {
    const result = tokenize('[zargh,blagh,fnargh[1,2,3]]')
    expect(result).toMatchObject([
      {type: '['},
      {type: 'Identifier', value: 'zargh'},
      {type: ','},
      {type: 'Identifier', value: 'blagh'},
      {type: ','},
      {type: 'Identifier', value: 'fnargh'},
      {type: '['},
      {type: 'Number', value: 1},
      {type: ','},
      {type: 'Number', value: 2},
      {type: ','},
      {type: 'Number', value: 3},
      {type: ']'},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('tokenizes escaped quotes example', () => {
    const result = tokenize("'escaped \\'single quotes\\''")
    expect(result).toMatchObject([
      {type: 'Identifier', value: "escaped 'single quotes'"},
      {type: 'EOF'},
    ])
  })

  test('tokenizes Unicode example', () => {
    const result = tokenize('"escaped \\u00E5 UTF-8"')
    expect(result).toMatchObject([{type: 'String', value: 'escaped å UTF-8'}, {type: 'EOF'}])
  })
})

describe('Null Tokens', () => {
  test('parses null literal', () => {
    expect(tokenize('null')).toMatchObject([{type: 'Null'}, {type: 'EOF'}])
  })

  test('parses null in expression context', () => {
    expect(tokenize('items[value == null]')).toMatchObject([
      {type: 'Identifier', value: 'items'},
      {type: '['},
      {type: 'Identifier', value: 'value'},
      {type: 'Operator', value: '=='},
      {type: 'Null'},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('parses both null and other values in sequence', () => {
    expect(tokenize('[null, true, false]')).toMatchObject([
      {type: '['},
      {type: 'Null'},
      {type: ','},
      {type: 'Boolean', value: true},
      {type: ','},
      {type: 'Boolean', value: false},
      {type: ']'},
      {type: 'EOF'},
    ])
  })

  test('distinguishes null from similar identifier', () => {
    expect(tokenize('nullish')).toMatchObject([
      {type: 'Identifier', value: 'nullish'},
      {type: 'EOF'},
    ])
  })
})
