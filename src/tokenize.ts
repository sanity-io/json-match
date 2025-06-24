import {createCursor, type Cursor} from './cursor'

type CharacterCursor = Cursor<string, string | RegExp>

export type Operator = '==' | '!=' | '>' | '<' | '>=' | '<='
export type Token =
  | {type: 'Number'; value: number; position: number}
  | {type: 'String'; value: string; position: number}
  | {type: 'Boolean'; value: boolean; position: number}
  | {type: 'Null'; position: number}
  | {type: 'Identifier'; value: string; position: number}
  | {type: 'Operator'; value: Operator; position: number}
  | {type: '.'; position: number}
  | {type: '..'; position: number}
  | {type: '['; position: number}
  | {type: ']'; position: number}
  | {type: ','; position: number}
  | {type: ':'; position: number}
  | {type: '?'; position: number}
  | {type: '*'; position: number}
  | {type: 'This'; position: number}
  | {type: 'EOF'; position: number}

export function tokenize(expression: string): Token[] {
  return tokenizePathExpression(
    createCursor({
      values: expression,
      fallback: '',
      validator: (expected: string | RegExp, value, position) => {
        if (typeof expected === 'string' && expected !== value) {
          throw new SyntaxError(
            `Expected \`${expected}\` at position ${position}${
              value ? ` but got \`${value}\` instead` : ''
            }`,
          )
        }

        if (expected instanceof RegExp && !expected.test(value)) {
          throw new SyntaxError(
            `Expected character \`${value}\` at position ${position} to match ${expected}`,
          )
        }
      },
    }),
  )
}

function tokenizePathExpression(cursor: CharacterCursor): Token[] {
  const tokens: Token[] = []
  // Main tokenization loop
  while (cursor.hasNext()) {
    const char = cursor()
    const position = cursor.position

    // skip whitespace
    if (/\s/.test(char)) {
      cursor.consume()
      continue
    }

    switch (char) {
      case '"': {
        tokens.push(parseStringLiteral(cursor))
        continue
      }

      case "'": {
        tokens.push(parseQuotedIdentifier(cursor))
        continue
      }

      case '[':
      case ']':
      case ',':
      case ':':
      case '?':
      case '*': {
        cursor.consume()
        tokens.push({type: char, position})
        continue
      }

      case '$':
      case '@': {
        // Check if this is followed by identifier characters
        if (/[a-zA-Z_$]/.test(cursor(1))) {
          // This is an identifier starting with $ or @
          tokens.push(parseIdentifier(cursor))
          continue
        }

        // This is a standalone $ or @ (This token)
        cursor.consume()
        tokens.push({type: 'This', position})
        continue
      }

      case '.': {
        cursor.consume()

        if (cursor() === '.') {
          cursor.consume()
          tokens.push({type: '..', position})
          continue
        }

        tokens.push({type: '.', position})
        continue
      }

      case '=':
      case '!':
      case '>':
      case '<': {
        tokens.push(parseOperator(cursor))
        continue
      }

      default: {
        if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(cursor(1)))) {
          tokens.push(parseNumber(cursor))
          continue
        }

        if (/[a-zA-Z_$]/.test(char)) {
          tokens.push(parseIdentifierOrBoolean(cursor))
          continue
        }

        throw new Error(`Unexpected character '${char}' at position ${position}`)
      }
    }
  }

  tokens.push({type: 'EOF', position: cursor.position})
  return tokens
}

function parseStringLiteral(cursor: CharacterCursor): Token {
  const position = cursor.position
  let value = ''

  cursor.consume('"')
  while (cursor.hasNext() && cursor() !== '"') {
    if (cursor() === '\\') {
      value += parseEscapeSequence(cursor)
    } else {
      value += cursor.consume()
    }
  }
  cursor.consume('"')

  return {type: 'String', value, position}
}

function parseQuotedIdentifier(cursor: CharacterCursor): Token {
  const position = cursor.position
  let value = ''

  cursor.consume("'")
  while (cursor.hasNext() && cursor() !== "'") {
    if (cursor() === '\\') {
      value += parseEscapeSequence(cursor)
    } else {
      value += cursor.consume()
    }
  }
  cursor.consume("'")

  return {type: 'Identifier', value, position}
}

function parseIdentifier(cursor: CharacterCursor): Token {
  const position = cursor.position
  let value = ''

  // First character: [a-zA-Z_$]
  value += cursor.consume(/[a-zA-Z_$]/)

  // Subsequent characters: [a-zA-Z0-9_$]
  while (/[a-zA-Z0-9_$]/.test(cursor())) {
    value += cursor.consume()
  }

  return {type: 'Identifier', value, position}
}

function parseIdentifierOrBoolean(cursor: CharacterCursor): Token {
  const position = cursor.position
  let value = ''

  // First character: [a-zA-Z_$]
  value += cursor.consume(/[a-zA-Z_$]/)

  // Subsequent characters: [a-zA-Z0-9_$]
  while (/[a-zA-Z0-9_$]/.test(cursor())) {
    value += cursor.consume()
  }

  if (value === 'null') {
    return {type: 'Null', position}
  }

  // Check if this is a boolean literal
  if (value === 'true') {
    return {type: 'Boolean', value: true, position}
  }
  if (value === 'false') {
    return {type: 'Boolean', value: false, position}
  }

  return {type: 'Identifier', value, position}
}

function parseEscapeSequence(cursor: CharacterCursor): string {
  cursor.consume('\\')
  const escaped = cursor.consume()
  switch (escaped) {
    case '"':
    case "'":
    case '\\':
    case '/': {
      return escaped
    }
    case 'b': {
      return '\b'
    }
    case 'f': {
      return '\f'
    }
    case 'n': {
      return '\n'
    }
    case 'r': {
      return '\r'
    }
    case 't': {
      return '\t'
    }
    case 'u': {
      // Parse Unicode escape sequence \uXXXX
      let unicode = ''
      for (let i = 0; i < 4; i++) {
        unicode += cursor.consume(/[0-9a-fA-F]/)
      }

      return String.fromCharCode(parseInt(unicode, 16))
    }
    default: {
      throw new Error(`Invalid escape sequence \\${escaped} at position ${cursor.position - 1}`)
    }
  }
}

function parseOperator(cursor: CharacterCursor): Token {
  const position = cursor.position
  const char = cursor()
  const next = cursor(1)

  if (char === '=' && next === '=') {
    cursor.consume()
    cursor.consume()
    return {type: 'Operator', value: '==', position}
  }
  if (char === '!' && next === '=') {
    cursor.consume()
    cursor.consume()
    return {type: 'Operator', value: '!=', position}
  }
  if (char === '>' && next === '=') {
    cursor.consume()
    cursor.consume()
    return {type: 'Operator', value: '>=', position}
  }
  if (char === '<' && next === '=') {
    cursor.consume()
    cursor.consume()
    return {type: 'Operator', value: '<=', position}
  }
  if (char === '>') {
    cursor.consume()
    return {type: 'Operator', value: '>', position}
  }
  if (char === '<') {
    cursor.consume()
    return {type: 'Operator', value: '<', position}
  }

  throw new SyntaxError(`Invalid operator at position ${position}`)
}

function parseNumber(cursor: CharacterCursor): Token {
  const position = cursor.position
  let value = ''

  // Handle negative sign
  if (cursor() === '-') {
    value += cursor.consume()
  }

  // Parse integer part
  while (/[0-9]/.test(cursor())) {
    value += cursor.consume()
  }

  // Parse decimal part if present
  if (cursor() === '.' && /[0-9]/.test(cursor(1))) {
    value += cursor.consume()
    while (/[0-9]/.test(cursor())) {
      value += cursor.consume()
    }
  }

  return {type: 'Number', value: parseFloat(value), position}
}
