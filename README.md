# JSONMatch

A powerful, lightweight implementation of the JSONMatch path expression language used by Sanity.io for document querying and manipulation.

## Features

- 🚀 **Lightweight** - Small bundle size with efficient lazy evaluation
- ⚡ **Performance** - Generator-based evaluation with constant-time cached lookups for keyed arrays
- 🔧 **Interoperable** - Works seamlessly with Sanity's existing path formats
- 🎯 **JSONPath-like** - Familiar syntax for those coming from JSONPath
- 📦 **Universal** - Works in Node.js and browsers with full type safety

## Installation

```bash
npm install @sanity/json-match
```

## Quick Start

```javascript
import {jsonMatch} from '@sanity/json-match'

const data = {
  users: [
    {name: 'Alice', age: 25, active: true},
    {name: 'Bob', age: 30, active: false},
    {name: 'Carol', age: 35, active: true},
  ],
}

// Find all active users
const activeUsers = Array.from(jsonMatch(data, 'users[active == true]'))
console.log(activeUsers.map((match) => match.value))
// [{ name: "Alice", age: 25, active: true }, { name: "Carol", age: 35, active: true }]

// Get names of users over 28
const olderUserNames = Array.from(jsonMatch(data, 'users[age > 28].name'))
console.log(olderUserNames.map((match) => match.value))
// ["Bob", "Carol"]
```

## Core Concepts

### JSONMatch vs Traditional Paths

Traditional Sanity paths use a simple array format like `['users', 0, 'name']` to point to a single value. JSONMatch expressions are more powerful - they can match multiple values and support complex filtering:

```typescript
// Traditional path (single value)
const traditionalPath = ['users', 0, 'name']

// JSONMatch expression (potentially multiple values)
const jsonMatchExpr = 'users[age > 25].name'
```

### Match Entries

When you evaluate a JSONMatch expression, you get back `MatchEntry` objects containing both the matched value and its path:

```javascript
import {jsonMatch} from '@sanity/json-match'

const data = {users: [{name: 'Alice'}, {name: 'Bob'}]}
const matches = Array.from(jsonMatch(data, 'users[*].name'))

matches.forEach((match) => {
  console.log(`Value: ${match.value}, Path: ${JSON.stringify(match.path)}`)
})
// Value: Alice, Path: ["users",0,"name"]
// Value: Bob, Path: ["users",1,"name"]
```

### Lazy Evaluation with Generators

JSONMatch uses generators for efficient lazy evaluation, meaning you can process large datasets without loading everything into memory:

```javascript
const hugeDataset = {
  items: new Array(1000000).fill(0).map((_, i) => ({id: i, active: i % 1000 === 0})),
}

// Find first active item without processing the entire array
for (const match of jsonMatch(hugeDataset, 'items[active == true]')) {
  console.log('First active item:', match.value)
  break // Only processes until first match is found
}
```

## Path Expression Syntax

### Basic Property Access

```javascript
const data = {user: {profile: {email: 'alice@example.com'}}}

// Simple property
jsonMatch(data, 'user') // [{ value: { profile: { email: "..." } }, path: ["user"] }]

// Nested properties
jsonMatch(data, 'user.profile.email') // [{ value: "alice@example.com", path: ["user", "profile", "email"] }]

// Quoted identifiers for special characters
jsonMatch(data, "'user-data'.'first-name'")
```

### Array Access

```javascript
const data = {items: ['apple', 'banana', 'cherry', 'date']}

// By index
jsonMatch(data, 'items[0]') // [{ value: "apple", path: ["items", 0] }]
jsonMatch(data, 'items[-1]') // [{ value: "date", path: ["items", 3] }]

// Slicing
jsonMatch(data, 'items[1:3]') // banana, cherry
jsonMatch(data, 'items[1:]') // banana, cherry, date
jsonMatch(data, 'items[:2]') // apple, banana

// Multiple indices
jsonMatch(data, 'items[0, 2]') // apple, cherry

// Wildcard (all elements)
jsonMatch(data, 'items[*]') // all items
```

### Filtering with Constraints

```javascript
const data = {
  products: [
    {name: 'Laptop', price: 999, category: 'electronics'},
    {name: 'Book', price: 15, category: 'books'},
    {name: 'Phone', price: 699, category: 'electronics'},
  ],
}

// Comparison operators
jsonMatch(data, 'products[price > 500]') // Laptop, Phone
jsonMatch(data, 'products[price <= 20]') // Book
jsonMatch(data, "products[category == 'books']") // Book
jsonMatch(data, "products[category != 'books']") // Laptop, Phone

// Existence checks
jsonMatch(data, 'products[price?]') // All products (they all have price)

// Multiple constraints (OR logic)
jsonMatch(data, "products[price < 100, category == 'electronics']") // Book, Laptop, Phone

// Chained constraints (AND logic)
jsonMatch(data, "products[category == 'electronics'][price > 700]") // Phone only
```

### Recursive Descent

```javascript
const data = {
  company: {
    departments: [
      {
        name: 'Engineering',
        teams: [
          {name: 'Frontend', members: [{name: 'Alice'}]},
          {name: 'Backend', members: [{name: 'Bob'}]},
        ],
      },
    ],
  },
}

// Find all names anywhere in the structure
jsonMatch(data, '..name')
// ["Engineering", "Frontend", "Alice", "Backend", "Bob"]

// Recursive descent with filtering
jsonMatch(data, "..members[name == 'Alice']")
// [{ name: "Alice" }]
```

### Expression Unions

```javascript
const data = {user: {name: 'Alice', email: 'alice@example.com'}, config: {theme: 'dark'}}

// Select multiple expressions
jsonMatch(data, '[user.name, user.email, config.theme]')
// ["Alice", "alice@example.com", "dark"]
```

## API Reference

### Core Functions

#### `jsonMatch(value, expression, basePath?)`

The main function for evaluating JSONMatch expressions.

```javascript
import {jsonMatch} from '@sanity/json-match'

const data = {users: [{name: 'Alice', age: 25}]}

// Basic usage
const matches = Array.from(jsonMatch(data, 'users[*].name'))

// With base path (useful for nested evaluation)
const nestedMatches = Array.from(jsonMatch(data.users, '[*].name', ['users']))
```

#### `stringifyPath(ast)`

Convert a parsed JSONMatch AST back to its string representation.

```javascript
import {parse, stringifyPath} from '@sanity/json-match'

const ast = parse('users[age > 21].name')
const str = stringifyPath(ast) // "users[age>21].name"

// Useful for normalizing expressions
const normalized = stringifyPath(parse('  users  [  age  >  21  ] . name  '))
console.log(normalized) // "users[age>21].name"
```

### Path Manipulation Utilities

#### `getParentPath(path)`

Extract the parent path from any path format.

```javascript
import {getParentPath} from '@sanity/json-match'

getParentPath('user.profile.email') // 'user.profile'
getParentPath('items[0].name') // 'items[0]'
getParentPath(['user', 'profile']) // 'user'
getParentPath('user') // undefined (no parent)
```

#### `addPathSegment(path, segment)`

Add a new segment to an existing path.

```javascript
import {addPathSegment} from '@sanity/json-match'

// Adding properties
addPathSegment('user', 'profile') // 'user.profile'

// Adding array indices
addPathSegment('items', 0) // 'items[0]'

// Adding keyed objects
addPathSegment('users', {_key: 'u1'}) // 'users[_key=="u1"]'

// Adding slices
addPathSegment('items', [1, 3]) // 'items[1:3]'

// Chaining operations
let path = 'data'
path = addPathSegment(path, 'users') // 'data.users'
path = addPathSegment(path, 0) // 'data.users[0]'
path = addPathSegment(path, 'profile') // 'data.users[0].profile'
```

#### `parsePath(input)`

Parse various path formats into a standardized AST.

```javascript
import {parsePath} from '@sanity/json-match'

// String expressions
parsePath('user.profile.email')

// CompatPath arrays
parsePath(['users', 0, {_key: 'profile'}, 'email'])

// Already parsed AST (returns unchanged)
const ast = parse('items[*]')
parsePath(ast) === ast // true
```

#### `getIndexForKey(array, key)`

Efficiently find the array index for objects with `_key` properties (Sanity's keyed arrays).

```javascript
import {getIndexForKey} from '@sanity/json-match'

const keyedArray = [
  {_key: 'item1', name: 'First'},
  {_key: 'item2', name: 'Second'},
  {_key: 'item3', name: 'Third'},
]

const index = getIndexForKey(keyedArray, 'item2') // 1
console.log(keyedArray[index]) // { _key: 'item2', name: 'Second' }

// Performance: First call builds cache, subsequent calls are O(1)
const index2 = getIndexForKey(keyedArray, 'item3') // Fast lookup
```

## Advanced Usage

### Working with Sanity Documents

```javascript
import {jsonMatch, addPathSegment, getParentPath} from '@sanity/json-match'

// Sanity document structure
const document = {
  _id: 'doc1',
  title: 'My Article',
  content: [
    {
      _type: 'block',
      _key: 'block1',
      children: [
        {_type: 'span', _key: 'span1', text: 'Hello '},
        {_type: 'span', _key: 'span2', text: 'world', marks: ['strong']},
      ],
    },
  ],
}

// Find all spans with strong marks
const strongSpans = Array.from(
  jsonMatch(document, "content[_type == 'block'].children[marks[@ == 'strong']]"),
)

// Build path to a specific span
let spanPath = addPathSegment('content', {_key: 'block1'})
spanPath = addPathSegment(spanPath, 'children')
spanPath = addPathSegment(spanPath, {_key: 'span2'})
// Result: "content[_key=='block1'].children[_key=='span2']"

// Get the parent block path
const blockPath = getParentPath(spanPath)
// Result: "content[_key=='block1'].children"
```

### Performance Optimization

```javascript
// Use generators for large datasets
function findFirst(data, expression, predicate) {
  for (const match of jsonMatch(data, expression)) {
    if (predicate(match.value)) {
      return match.value
    }
  }
  return undefined
}

// Efficient keyed array operations
const users = [
  /* thousands of users with _key properties */
]
const targetUserIndex = getIndexForKey(users, 'user-12345') // O(1) after first call
```

### Type Safety

When using TypeScript, the library provides full type definitions:

```typescript
import {jsonMatch, type MatchEntry, type Path} from '@sanity/json-match'

interface User {
  name: string
  age: number
  active: boolean
}

const data = {
  users: [{name: 'Alice', age: 25, active: true}],
}

// Fully typed results
const userMatches: MatchEntry[] = Array.from(jsonMatch(data, 'users[*]'))
const users: User[] = userMatches.map((match) => match.value as User)

// Paths use a simple segment format
const paths: Path[] = userMatches.map((match) => match.path)
```

## JSONMatch Language Reference

### Quick Reference

| Expression       | Description       | Example                   |
| ---------------- | ----------------- | ------------------------- |
| `field`          | Property access   | `user.name`               |
| `[index]`        | Array index       | `items[0]`, `items[-1]`   |
| `[start:end]`    | Array slice       | `items[1:3]`, `items[2:]` |
| `[*]`            | All elements      | `users[*].name`           |
| `[condition]`    | Filter            | `users[age > 21]`         |
| `..`             | Recursive descent | `..name`                  |
| `[expr1, expr2]` | Union             | `[name, email]`           |
| `field?`         | Existence check   | `users[email?]`           |

### Operators

| Operator | Description      | Example                |
| -------- | ---------------- | ---------------------- |
| `==`     | Equal            | `[status == "active"]` |
| `!=`     | Not equal        | `[type != "draft"]`    |
| `>`      | Greater than     | `[age > 18]`           |
| `<`      | Less than        | `[price < 100]`        |
| `>=`     | Greater or equal | `[score >= 90]`        |
| `<=`     | Less or equal    | `[count <= 10]`        |

### Formal Grammar

```enbf
Expression ::=
  | String // literal
  | Number // literal
  | Boolean // literal
  | Path


Path ::=
  | '.' Path    // implicit 'this' descent
  | '..' Path   // implicit 'this' recursive descent
  | PathSegment
  | PathSegment '.' Path
  | PathSegment '..' Path

PathSegment ::=
  | This
  | Identifier
  | Wildcard
  | Subscript

Subscript ::=
  | '[' SubscriptContent ']'

SubscriptContent ::=
  | SubscriptElement
  | SubscriptElement ',' SubscriptContent

SubscriptElement ::=
  | Slice
  | Existence
  | Comparison
  | Expression

Slice ::=
  | Number ':' Number
  | Number ':'
  | ':' Number
  | ':'

Existence ::=
  | Path '?'

Comparison ::=
  | Expression ComparisonOperator Expression

ComparisonOperator ::=
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='

This ::=
  | '@'
  | '$'

Identifier ::=
  | UnquotedIdentifier
  | QuotedIdentifier

Wildcard ::=
  | '*'

Number ::=
  | '-'? [0-9]+ ('.' [0-9]+)?

Boolean ::=
  | 'true'
  | 'false'

String ::=
  | '"' StringContent '"'

StringContent ::=
  | (EscapeSequence | [^"\\])*

EscapeSequence ::=
  | '\\' ['"\\\/bfnrt]
  | '\\u' HexDigit HexDigit HexDigit HexDigit

HexDigit ::=
  | [0-9a-fA-F]

UnquotedIdentifier ::=
  | [a-zA-Z_$][a-zA-Z0-9_$]*

QuotedIdentifier ::=
  | "'" QuotedIdentifierContent "'"

QuotedIdentifierContent ::=
  | (EscapeSequence | [^'\\])*
```

## License

MIT License - see LICENSE file for details.
