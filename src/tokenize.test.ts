import { describe, test, expect } from 'vitest';
import { tokenize, type Token } from './tokenize';

// Helper function to extract just the type and value (omitting position for cleaner tests)
function simplifyTokens(tokens: Token[]): Array<Omit<Token, 'position'>> {
  return tokens.map(({ position, ...token }) => token);
}

describe('Number Tokens', () => {
  test('parses positive integers', () => {
    expect(simplifyTokens(tokenize('42'))).toEqual([
      { type: 'Number', value: 42 },
      { type: 'EOF' },
    ]);
  });

  test('parses negative integers', () => {
    expect(simplifyTokens(tokenize('-17'))).toEqual([
      { type: 'Number', value: -17 },
      { type: 'EOF' },
    ]);
  });

  test('parses positive floats', () => {
    expect(simplifyTokens(tokenize('3.14'))).toEqual([
      { type: 'Number', value: 3.14 },
      { type: 'EOF' },
    ]);
  });

  test('parses negative floats', () => {
    expect(simplifyTokens(tokenize('-99.99'))).toEqual([
      { type: 'Number', value: -99.99 },
      { type: 'EOF' },
    ]);
  });

  test('parses zero', () => {
    expect(simplifyTokens(tokenize('0'))).toEqual([
      { type: 'Number', value: 0 },
      { type: 'EOF' },
    ]);
  });

  test('parses zero with decimal', () => {
    expect(simplifyTokens(tokenize('0.5'))).toEqual([
      { type: 'Number', value: 0.5 },
      { type: 'EOF' },
    ]);
  });
});

describe('String Literal Tokens', () => {
  test('parses simple string', () => {
    expect(simplifyTokens(tokenize('"hello"'))).toEqual([
      { type: 'String', value: 'hello' },
      { type: 'EOF' },
    ]);
  });

  test('parses empty string', () => {
    expect(simplifyTokens(tokenize('""'))).toEqual([
      { type: 'String', value: '' },
      { type: 'EOF' },
    ]);
  });

  test('parses string with escaped quotes', () => {
    expect(simplifyTokens(tokenize('"escaped \\"quotes\\""'))).toEqual([
      { type: 'String', value: 'escaped "quotes"' },
      { type: 'EOF' },
    ]);
  });

  test('parses string with escaped backslash', () => {
    expect(simplifyTokens(tokenize('"path\\\\to\\\\file"'))).toEqual([
      { type: 'String', value: 'path\\to\\file' },
      { type: 'EOF' },
    ]);
  });

  test('parses string with escaped forward slash', () => {
    expect(simplifyTokens(tokenize('"url\\/path"'))).toEqual([
      { type: 'String', value: 'url/path' },
      { type: 'EOF' },
    ]);
  });

  test('parses string with control characters', () => {
    expect(simplifyTokens(tokenize('"line1\\nline2\\tindented"'))).toEqual([
      { type: 'String', value: 'line1\nline2\tindented' },
      { type: 'EOF' },
    ]);
  });

  test('parses string with all control characters', () => {
    expect(simplifyTokens(tokenize('"\\b\\f\\n\\r\\t"'))).toEqual([
      { type: 'String', value: '\b\f\n\r\t' },
      { type: 'EOF' },
    ]);
  });

  test('parses string with Unicode escape', () => {
    expect(simplifyTokens(tokenize('"\\u00E5"'))).toEqual([
      { type: 'String', value: 'å' },
      { type: 'EOF' },
    ]);
  });

  test('parses string with Unicode surrogate pair', () => {
    expect(simplifyTokens(tokenize('"\\uD834\\uDD1E"'))).toEqual([
      { type: 'String', value: '𝄞' },
      { type: 'EOF' },
    ]);
  });

  test('parses string with Unicode adjacent to text', () => {
    expect(simplifyTokens(tokenize('"\\u00E5abc"'))).toEqual([
      { type: 'String', value: 'åabc' },
      { type: 'EOF' },
    ]);
  });

  test('throws on unterminated string', () => {
    expect(() => tokenize('"unterminated')).toThrow('Expected `"`');
  });

  test('throws on invalid escape sequence', () => {
    expect(() => tokenize('"invalid\\x"')).toThrow(
      'Invalid escape sequence \\x at position 9',
    );
  });

  test('throws on invalid Unicode escape', () => {
    expect(() => tokenize('"\\uXXXX"')).toThrow('Expected character `X`');
  });
});

describe('Identifier Tokens', () => {
  test('parses simple identifier', () => {
    expect(simplifyTokens(tokenize('name'))).toEqual([
      { type: 'Identifier', value: 'name' },
      { type: 'EOF' },
    ]);
  });

  test('parses identifier with numbers', () => {
    expect(simplifyTokens(tokenize('item123'))).toEqual([
      { type: 'Identifier', value: 'item123' },
      { type: 'EOF' },
    ]);
  });

  test('parses identifier with underscore and dollar', () => {
    expect(simplifyTokens(tokenize('_$valid_identifier$'))).toEqual([
      { type: 'Identifier', value: '_$valid_identifier$' },
      { type: 'EOF' },
    ]);
  });

  test('parses quoted identifier', () => {
    expect(simplifyTokens(tokenize("'field-name'"))).toEqual([
      { type: 'Identifier', value: 'field-name' },
      { type: 'EOF' },
    ]);
  });

  test('parses quoted identifier with special characters', () => {
    expect(simplifyTokens(tokenize("'@type'"))).toEqual([
      { type: 'Identifier', value: '@type' },
      { type: 'EOF' },
    ]);
  });

  test('parses quoted identifier with escaped single quotes', () => {
    expect(simplifyTokens(tokenize("'can\\'t'"))).toEqual([
      { type: 'Identifier', value: "can't" },
      { type: 'EOF' },
    ]);
  });

  test('parses quoted identifier with mixed quotes', () => {
    expect(simplifyTokens(tokenize(`'has"quotes'`))).toEqual([
      { type: 'Identifier', value: 'has"quotes' },
      { type: 'EOF' },
    ]);
  });

  test('parses quoted identifier with Unicode', () => {
    expect(simplifyTokens(tokenize("'field-\\u00E5'"))).toEqual([
      { type: 'Identifier', value: 'field-å' },
      { type: 'EOF' },
    ]);
  });

  test('throws on unterminated quoted identifier', () => {
    expect(() => tokenize("'unterminated")).toThrow("Expected `'`");
  });
});

describe('Operator Tokens', () => {
  test('parses equality operator', () => {
    expect(simplifyTokens(tokenize('=='))).toEqual([
      { type: 'Operator', value: '==' },
      { type: 'EOF' },
    ]);
  });

  test('parses inequality operator', () => {
    expect(simplifyTokens(tokenize('!='))).toEqual([
      { type: 'Operator', value: '!=' },
      { type: 'EOF' },
    ]);
  });

  test('parses greater than operator', () => {
    expect(simplifyTokens(tokenize('>'))).toEqual([
      { type: 'Operator', value: '>' },
      { type: 'EOF' },
    ]);
  });

  test('parses less than operator', () => {
    expect(simplifyTokens(tokenize('<'))).toEqual([
      { type: 'Operator', value: '<' },
      { type: 'EOF' },
    ]);
  });

  test('parses greater than or equal operator', () => {
    expect(simplifyTokens(tokenize('>='))).toEqual([
      { type: 'Operator', value: '>=' },
      { type: 'EOF' },
    ]);
  });

  test('parses less than or equal operator', () => {
    expect(simplifyTokens(tokenize('<='))).toEqual([
      { type: 'Operator', value: '<=' },
      { type: 'EOF' },
    ]);
  });
});

describe('Punctuation Tokens', () => {
  test('parses dot', () => {
    expect(simplifyTokens(tokenize('.'))).toEqual([
      { type: '.' },
      { type: 'EOF' },
    ]);
  });

  test('parses double dot', () => {
    expect(simplifyTokens(tokenize('..'))).toEqual([
      { type: '..' },
      { type: 'EOF' },
    ]);
  });

  test('parses left bracket', () => {
    expect(simplifyTokens(tokenize('['))).toEqual([
      { type: '[' },
      { type: 'EOF' },
    ]);
  });

  test('parses right bracket', () => {
    expect(simplifyTokens(tokenize(']'))).toEqual([
      { type: ']' },
      { type: 'EOF' },
    ]);
  });

  test('parses comma', () => {
    expect(simplifyTokens(tokenize(','))).toEqual([
      { type: ',' },
      { type: 'EOF' },
    ]);
  });

  test('parses colon', () => {
    expect(simplifyTokens(tokenize(':'))).toEqual([
      { type: ':' },
      { type: 'EOF' },
    ]);
  });

  test('parses question mark', () => {
    expect(simplifyTokens(tokenize('?'))).toEqual([
      { type: '?' },
      { type: 'EOF' },
    ]);
  });

  test('parses wildcard', () => {
    expect(simplifyTokens(tokenize('*'))).toEqual([
      { type: '*' },
      { type: 'EOF' },
    ]);
  });
});

describe('This Context Tokens', () => {
  test('parses dollar sign', () => {
    expect(simplifyTokens(tokenize('$'))).toEqual([
      { type: 'This' },
      { type: 'EOF' },
    ]);
  });

  test('parses at sign', () => {
    expect(simplifyTokens(tokenize('@'))).toEqual([
      { type: 'This' },
      { type: 'EOF' },
    ]);
  });
});

describe('Whitespace Handling', () => {
  test('skips spaces', () => {
    expect(simplifyTokens(tokenize(' name '))).toEqual([
      { type: 'Identifier', value: 'name' },
      { type: 'EOF' },
    ]);
  });

  test('skips tabs and newlines', () => {
    expect(simplifyTokens(tokenize('\t\nname\r\n'))).toEqual([
      { type: 'Identifier', value: 'name' },
      { type: 'EOF' },
    ]);
  });

  test('handles whitespace between tokens', () => {
    expect(simplifyTokens(tokenize('name . field'))).toEqual([
      { type: 'Identifier', value: 'name' },
      { type: '.' },
      { type: 'Identifier', value: 'field' },
      { type: 'EOF' },
    ]);
  });
});

describe('Complex Expressions', () => {
  test('tokenizes simple property access', () => {
    expect(simplifyTokens(tokenize('user.name'))).toEqual([
      { type: 'Identifier', value: 'user' },
      { type: '.' },
      { type: 'Identifier', value: 'name' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes array access with index', () => {
    expect(simplifyTokens(tokenize('items[0]'))).toEqual([
      { type: 'Identifier', value: 'items' },
      { type: '[' },
      { type: 'Number', value: 0 },
      { type: ']' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes array slice', () => {
    expect(simplifyTokens(tokenize('items[1:3]'))).toEqual([
      { type: 'Identifier', value: 'items' },
      { type: '[' },
      { type: 'Number', value: 1 },
      { type: ':' },
      { type: 'Number', value: 3 },
      { type: ']' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes wildcard access', () => {
    expect(simplifyTokens(tokenize('items[*].name'))).toEqual([
      { type: 'Identifier', value: 'items' },
      { type: '[' },
      { type: '*' },
      { type: ']' },
      { type: '.' },
      { type: 'Identifier', value: 'name' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes constraint with comparison', () => {
    expect(simplifyTokens(tokenize('users[age > 21]'))).toEqual([
      { type: 'Identifier', value: 'users' },
      { type: '[' },
      { type: 'Identifier', value: 'age' },
      { type: 'Operator', value: '>' },
      { type: 'Number', value: 21 },
      { type: ']' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes constraint with string literal', () => {
    expect(simplifyTokens(tokenize('items[status == "active"]'))).toEqual([
      { type: 'Identifier', value: 'items' },
      { type: '[' },
      { type: 'Identifier', value: 'status' },
      { type: 'Operator', value: '==' },
      { type: 'String', value: 'active' },
      { type: ']' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes existence constraint', () => {
    expect(simplifyTokens(tokenize('users[email?]'))).toEqual([
      { type: 'Identifier', value: 'users' },
      { type: '[' },
      { type: 'Identifier', value: 'email' },
      { type: '?' },
      { type: ']' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes implicit root access', () => {
    expect(simplifyTokens(tokenize('.bicycle.brand'))).toEqual([
      { type: '.' },
      { type: 'Identifier', value: 'bicycle' },
      { type: '.' },
      { type: 'Identifier', value: 'brand' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes recursive descent', () => {
    expect(simplifyTokens(tokenize('data..name'))).toEqual([
      { type: 'Identifier', value: 'data' },
      { type: '..' },
      { type: 'Identifier', value: 'name' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes bare recursive descent', () => {
    expect(simplifyTokens(tokenize('..'))).toEqual([
      { type: '..' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes expression union', () => {
    expect(simplifyTokens(tokenize('[name, email]'))).toEqual([
      { type: '[' },
      { type: 'Identifier', value: 'name' },
      { type: ',' },
      { type: 'Identifier', value: 'email' },
      { type: ']' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes quoted identifier with special characters', () => {
    expect(simplifyTokens(tokenize("'user-data'['first-name']"))).toEqual([
      { type: 'Identifier', value: 'user-data' },
      { type: '[' },
      { type: 'Identifier', value: 'first-name' },
      { type: ']' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes item context comparison', () => {
    expect(simplifyTokens(tokenize('[@ > 10]'))).toEqual([
      { type: '[' },
      { type: 'This' },
      { type: 'Operator', value: '>' },
      { type: 'Number', value: 10 },
      { type: ']' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes mixed subscript content', () => {
    expect(simplifyTokens(tokenize('products[1:3, price > 500]'))).toEqual([
      { type: 'Identifier', value: 'products' },
      { type: '[' },
      { type: 'Number', value: 1 },
      { type: ':' },
      { type: 'Number', value: 3 },
      { type: ',' },
      { type: 'Identifier', value: 'price' },
      { type: 'Operator', value: '>' },
      { type: 'Number', value: 500 },
      { type: ']' },
      { type: 'EOF' },
    ]);
  });
});

describe('Edge Cases and Error Handling', () => {
  test('handles empty input', () => {
    expect(simplifyTokens(tokenize(''))).toEqual([{ type: 'EOF' }]);
  });

  test('handles only whitespace', () => {
    expect(simplifyTokens(tokenize('   \t\n  '))).toEqual([{ type: 'EOF' }]);
  });

  test('throws on unexpected character', () => {
    expect(() => tokenize('#')).toThrow(
      "Unexpected character '#' at position 0",
    );
  });

  test('throws on invalid operator sequence', () => {
    expect(() => tokenize('=')).toThrow('Invalid operator at position 0');
  });

  test('throws on invalid operator sequence with !', () => {
    expect(() => tokenize('!')).toThrow('Invalid operator at position 0');
  });

  test('distinguishes negative numbers from operators', () => {
    expect(simplifyTokens(tokenize('age > -5'))).toEqual([
      { type: 'Identifier', value: 'age' },
      { type: 'Operator', value: '>' },
      { type: 'Number', value: -5 },
      { type: 'EOF' },
    ]);
  });

  test('handles number followed by dot operator', () => {
    expect(simplifyTokens(tokenize('3.field'))).toEqual([
      { type: 'Number', value: 3 },
      { type: '.' },
      { type: 'Identifier', value: 'field' },
      { type: 'EOF' },
    ]);
  });
});

describe('Position Tracking', () => {
  test('tracks token positions correctly', () => {
    const tokens = tokenize('name[0]');
    expect(tokens).toEqual([
      { type: 'Identifier', value: 'name', position: 0 },
      { type: '[', position: 4 },
      { type: 'Number', value: 0, position: 5 },
      { type: ']', position: 6 },
      { type: 'EOF', position: 7 },
    ]);
  });

  test('tracks positions with whitespace', () => {
    const tokens = tokenize('  name  [  0  ]  ');
    expect(tokens).toEqual([
      { type: 'Identifier', value: 'name', position: 2 },
      { type: '[', position: 8 },
      { type: 'Number', value: 0, position: 11 },
      { type: ']', position: 14 },
      { type: 'EOF', position: 17 },
    ]);
  });
});

describe('Real JSONMatch Examples from Spec', () => {
  test('tokenizes friends constraint example', () => {
    const result = simplifyTokens(
      tokenize('friends[age > 35, favoriteColor == "blue"]'),
    );
    expect(result).toEqual([
      { type: 'Identifier', value: 'friends' },
      { type: '[' },
      { type: 'Identifier', value: 'age' },
      { type: 'Operator', value: '>' },
      { type: 'Number', value: 35 },
      { type: ',' },
      { type: 'Identifier', value: 'favoriteColor' },
      { type: 'Operator', value: '==' },
      { type: 'String', value: 'blue' },
      { type: ']' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes complex nested union example', () => {
    const result = simplifyTokens(tokenize('[zargh,blagh,fnargh[1,2,3]]'));
    expect(result).toEqual([
      { type: '[' },
      { type: 'Identifier', value: 'zargh' },
      { type: ',' },
      { type: 'Identifier', value: 'blagh' },
      { type: ',' },
      { type: 'Identifier', value: 'fnargh' },
      { type: '[' },
      { type: 'Number', value: 1 },
      { type: ',' },
      { type: 'Number', value: 2 },
      { type: ',' },
      { type: 'Number', value: 3 },
      { type: ']' },
      { type: ']' },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes escaped quotes example', () => {
    const result = simplifyTokens(tokenize("'escaped \\'single quotes\\''"));
    expect(result).toEqual([
      { type: 'Identifier', value: "escaped 'single quotes'" },
      { type: 'EOF' },
    ]);
  });

  test('tokenizes Unicode example', () => {
    const result = simplifyTokens(tokenize('"escaped \\u00E5 UTF-8"'));
    expect(result).toEqual([
      { type: 'String', value: 'escaped å UTF-8' },
      { type: 'EOF' },
    ]);
  });
});
