# @sanity/json-match

[![npm version](https://img.shields.io/npm/v/@sanity/json-match.svg)](https://www.npmjs.com/package/@sanity/json-match) [![bundle size](https://deno.bundlejs.com/?q=@sanity/json-match&badge)](https://bundlejs.com/?q=@sanity/json-match) [![github status checks](https://badgen.net/github/checks/sanity-io/json-match)](https://github.com/sanity-io/json-match/actions) [![npm weekly downloads](https://img.shields.io/npm/dw/@sanity/json-match.svg)](https://www.npmjs.com/package/@sanity/json-match) [![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

> A modern, lightweight implementation of the [JSONMatch](https://www.sanity.io/docs/content-lake/json-match) path expression language made for low-level use in other libraries such as the Sanity App SDK.

## Table of Contents

- [Installation](#installation)
- [Core Concepts](#core-concepts)
  - [What is JSONMatch?](#what-is-jsonmatch)
  - [Lazy evaluation](#lazy-evaluation)
  - [Handling undefined values](#handling-undefined-values)
  - [Special `_key` handling](#special-_key-handling)
  - [Path manipulation](#path-manipulation)
- [JSONMatch Language Reference](#jsonmatch-language-reference)
- [API Reference](#api-reference)
  - [`jsonMatch(value, path, basePath?)`](#jsonmatchvalue-path-basepath)
  - [`stringifyPath(path)`](#stringifypathpath)
  - [`getIndexForKey(array, key)`](#getindexforkeyarray-key)
  - [`getPathDepth(path)`](#getpathdepthpath)
  - [`joinPaths(base, path)`](#joinpathsbase-path)
  - [`parsePath(input)`](#parsepathinput)
  - [`slicePath(path, start?, end?)`](#slicepathpath-start-end)
- [LICENSE](#license)

## Installation

```bash
npm install @sanity/json-match
```

## Core Concepts

### What is JSONMatch?

[JSONMatch](https://www.sanity.io/docs/content-lake/json-match) is a query language designed to select one or more sub-values within a JSON document.

Here's a quick example:

```typescript
import {jsonMatch} from '@sanity/json-match'

const data = {
  users: [
    {name: 'Alice', _key: 'alice', age: 25, active: true},
    {name: 'Bob', _key: 'bob', age: 30, active: false},
    {name: 'Carol', _key: 'carol', age: 35, active: true},
  ],
}

// 1. Write a path expression
const expression = 'users[active == true]'

// 2. Evaluate expression against a value
const matches = jsonMatch(data, expression)

// `jsonMatch` returns a generator of matches
for (const match of matches) {
  console.log('Matched Value:', match.value)
  console.log('Path to Value:', match.path)
}

// Output:
//
// Matched Value: {name: 'Alice', _key: 'alice', age: 25, active: true}
// Path to Value: ['users', {_key: 'alice'}]
//
// Matched Value: {name: 'Carol', _key: 'carol', age: 35, active: true}
// Path to Value: ['users', {_key: 'carol'}]
```

To use JSONMatch you:

1. **Write a path expression** (e.g. `users[active == true]`) that describes where to search (e.g. `users`) and what constraints must be satisfied (e.g. `[active == true]`). To use a path expression, you…
2. **Evaluate it against a JSON value**. The evaluator then searches the document and returns all the matches that satisfy your expression.

For each match found, you get back a `MatchEntry` object:

````ts
// This object is yielded from `jsonMatch`
export interface MatchEntry {
  /**
   * The subvalue found within the given JSON value. This is
   * referentially equal to the nested value in the JSON object.
   */
  value: unknown
  /**
   * An array of keys and indices representing the location of the value within
   * the original value. Note that the evaluator will only yield paths that
   * address a single value.
   *
   * ```ts
   * const path: Path = ['users', 0, 'profile', { _key: 'email' }]
   * // Represents: users[0].profile[_key=="email"]
   * ```
   */
  path: SingleValuePath
}

export type IndexTuple = [number | '', number | ''] // array slice e.g. [1:3]
export type KeyedSegment = {_key: string} // key constraint e.g. [_key=="val"]

export type PathSegment = string | number | KeyedSegment | IndexTuple
export type Path = PathSegment[]

// `SingleValuePath`s don't include the index tuple since that can map to many values
export type SingleValuePath = Exclude<PathSegment, IndexTuple>[]

// the `jsonMatch` function returns a Generator of `MatchEntry`
export function jsonMatch(value, pathExpr): Generator<MatchEntry>
````

> [!TIP]
> The `Path` format is a common representation in many other Sanity libraries making it easy to integrate with other Sanity tools.
>
> This path type can be turned back into a string with [`stringifyPath`](#stringifypathpath) if desired. See the [path manipulation](#path-manipulation) section for more path utilities.

### Lazy evaluation

The `jsonMatch` function is **lazy**, meaning it returns a [generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator) that yields matches one by one, only when you ask for them. It doesn't compute all possible matches upfront.

This design offers a significant performance advantage, especially when you're working with large datasets and only need the first few matches. For example, if you're looking for the first active item in an array of thousands of elements, `jsonMatch` will stop searching as soon as it finds it.

```javascript
import {jsonMatch} from '@sanity/json-match'

// A large array where the match is halfway through
const data = {
  items: Array.from({length: 1000}, (_, i) => ({
    id: i,
    active: i === 500, // Only item at index 500 is active
  })),
}

// Find the first active item
const generator = jsonMatch(data, 'items[active == true]')

// .next().value gets the first match without iterating the whole array
const firstMatch = generator.next().value

console.log('Found:', firstMatch.value)
// Found: { id: 500, active: true }
```

This makes the library suitable for performance-critical tasks where you need to find a single value quickly.

### Handling undefined values

`jsonMatch` yields matches for paths that resolve to `undefined` values, even when traversing through invalid intermediate values. This **exhaustive path traversal** behavior is designed to support both **reading** and **writing** operations in the Sanity ecosystem.

```javascript
import {jsonMatch} from '@sanity/json-match'

const data = {
  user: {
    name: 'Alice',
    // Note: no 'email' property
  },
  posts: [
    {title: 'First Post'},
    // Note: no second post at index 1
  ],
  version: '1.0.0', // This is a string, not an object
}

// Accessing non-existent properties yields undefined with the path
const emailMatches = Array.from(jsonMatch(data, 'user.email'))
console.log(emailMatches)
// [{ value: undefined, path: ['user', 'email'] }]

// Accessing out-of-bounds array indices also yields undefined
const missingPostMatches = Array.from(jsonMatch(data, 'posts[1].title'))
console.log(missingPostMatches)
// [{ value: undefined, path: ['posts', 1, 'title'] }]

// Even traversing through non-objects continues until path is exhausted
const invalidTraversal = Array.from(jsonMatch(data, 'version.major.patch'))
console.log(invalidTraversal)
// [{ value: undefined, path: ['version', 'major', 'patch'] }]
// Note: continues evaluating even though 'version' is a string

// Arrays with mixed types yield undefined for non-objects
const mixedArray = {
  items: ['string', {name: 'Alice'}, null, 42],
}
const mixedResults = Array.from(jsonMatch(mixedArray, 'items.name'))
console.log(mixedResults)
// [
//   { value: undefined, path: ['items', 0, 'name'] },  // string has no 'name'
//   { value: 'Alice', path: ['items', 1, 'name'] },    // object has 'name'
//   { value: undefined, path: ['items', 2, 'name'] },  // null has no 'name'
//   { value: undefined, path: ['items', 3, 'name'] }   // number has no 'name'
// ]

// This allows downstream systems to know where values can be set
const pathsForSetting = Array.from(jsonMatch(data, 'user.profile.settings.theme')).map(
  (m) => m.path,
)
console.log(pathsForSetting)
// [['user', 'profile', 'settings', 'theme']] - full path even if intermediate values don't exist!
```

**Why this matters:**

- **For reading**: You can distinguish between non-existent paths and paths that exist but contain `undefined`
- **For writing**: You get the exact path information needed to set values at locations that don't currently exist, even through multiple levels of missing intermediate values
- **For consistency**: The same path expression works for both reading existing values and determining where new values can be written
- **For completeness**: Arrays with mixed types (objects, primitives, null) yield results for all elements, with `undefined` for non-objects

**How exhaustive traversal works:**

1. **Property access** (`obj.prop`): Always yields a result, even if `obj` is not an object
2. **Array indexing** (`arr[0]`): Always yields a result, even if `arr` is not an array or index is out of bounds
3. **Deep paths** (`a.b.c.d`): Continues evaluating the entire path even if intermediate segments are invalid
4. **Array iteration** (`arr.prop`): Applies property access to every array element, yielding `undefined` for non-objects

> [!NOTE]  
> This exhaustive behavior only applies to property access and array indexing. Constraint-based filtering (like `[active == true]`) will still skip items that don't match the constraint, and existence checks (like `[email?]`) will not match `undefined` values.

### Special `_key` handling

In Sanity documents, it's good practice to add a unique `_key` property to objects inside an array. This gives each object a stable identifier that doesn't change even if the array is reordered.

`jsonMatch` has special first-class support for `_key`s to improve both path resilience and performance.

1. When a matched object has a `_key`, the returned path will use the key instead of the array index. This creates a path that remains valid even if other items are added, removed, or reordered.
2. When you filter an array by `_key` (e.g., `items[_key == "b"]`), this library creates and caches a lookup of indexes so subsequent evaluations of the same path expression will be cheap. See [`getIndexForKey`](#getindexforkeyarray-key) for more info.

> [!WARNING]
> For these optimizations to work reliably, **`_key` values are assumed to be unique within any given array.** If an array contains objects with duplicate `_key`s, the behavior is undefined, as the evaluator will typically match only the first object it finds.

### Path manipulation

This library ships with some helper functions to help modify and normalize paths. These utilities allow you to programmatically construct, deconstruct, and analyze paths in a consistent way, regardless of their original format (string, array, or AST).

Here are a few common use cases:

```ts
import {joinPaths, slicePath, getPathDepth, stringifyPath, type Path} from '@sanity/json-match'

// Path utilities work with path strings...
const originalPath = 'users[0].posts[_key=="abc"].title'
const parentFromString = slicePath(originalPath, 0, -1)
// -> users[0].posts[_key=="abc"]

// ...and Path arrays.
const originalPathArray: Path = ['users', 0, 'posts', {_key: 'abc'}, 'title']
const parentFromArray = slicePath(originalPathArray, 0, -1)
// -> users[0].posts[_key=="abc"]

// `joinPaths` also accepts both formats.
const newPath = joinPaths(parentFromArray, 'lastModified')
// -> users[0].posts[_key=="abc"].lastModified

// You can convert a Path array to its string equivalent with `stringifyPath`.
const pathString = stringifyPath(originalPathArray)
// -> users[0].posts[_key=="abc"].title
console.log(pathString === originalPath) // true

// Get the depth (number of segments) of a path.
const depth = getPathDepth(originalPath)
// -> 5
```

## JSONMatch Language Reference

See our [official documentation for JSONMatch](https://www.sanity.io/docs/content-lake/json-match).

```javascript
import {jsonMatch} from '@sanity/json-match'

// In this reference we will use the following example JSON object to extract data from:
const data = {
  name: 'fred',
  friends: [
    {name: 'mork', age: 40, favoriteColor: 'red'},
    {name: 'mindy', age: 32, favoriteColor: 'blue'},
    {name: 'franklin', favoriteColor: 'yellow'},
    {name: 'bob', favoriteColor: 'green'},
    {name: 'alice', favoriteColor: 'blue'},
  ],
  roles: ['admin', 'owner'],
  contactInfo: {
    streetAddress: '42 Mountain Road',
    state: {
      shortName: 'WY',
      longName: 'Wyoming',
    },
  },
}

function evaluate(expression) {
  const matches = jsonMatch(data, expression)
  const values = Array.from(matches).map((match) => match.value)
  console.log(values)
}

// Given the example document, these expressions can be evaluated
evaluate('name') // [ 'fred' ]
evaluate('friends[*].name') // [ 'mork', 'mindy', 'franklin', 'bob', 'alice' ]
evaluate('friends[age > 35].name') // [ 'mork' ]
evaluate('friends[age > 30, favoriteColor == "blue"].name') // [ 'mork', 'mindy', 'alice' ]
evaluate('friends[age?].age') // [ 40, 32 ]
evaluate('friends[0].name') // [ 'mork' ]
evaluate('friends[1:3].name') // [ 'mindy', 'franklin' ]
evaluate('friends[0, 2:3].name') // [ 'mork', 'franklin' ]
evaluate('contactInfo.state.shortName') // [ 'WY' ]
evaluate('contactInfo.state[shortName, longName]') // [ 'WY', 'Wyoming' ]
evaluate('friends.age[@ > 35]') // [ 40 ]
evaluate('roles') // [ [ 'admin', 'owner' ] ]
evaluate('roles[*]') // [ 'admin', 'owner' ]
evaluate('roles[0]') // [ 'admin' ]
evaluate('roles[-1]') // [ 'owner' ]
evaluate('contactInfo..shortName') // [ 'WY' ]
evaluate('[contactInfo.state.shortName, roles]') // [ 'WY', [ 'admin', 'owner' ] ]
```

<details>

<summary>Full EBNF Grammar</summary>

```ebnf
Expression ::=
  | String // literal
  | Number // literal
  | Boolean // literal
  | Null // literal
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

Null ::=
  | 'null'

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

</details>

## API Reference

### `jsonMatch(value, path, basePath?)`

The main function for evaluating JSONMatch expressions.

```javascript
import {jsonMatch} from '@sanity/json-match'

const data = {users: [{name: 'Alice', age: 25}]}

// Basic usage
const matches = Array.from(jsonMatch(data, 'users[*].name'))

// With base path (useful for nested evaluation)
const nestedMatches = Array.from(jsonMatch(data.users, '[*].name', ['users']))
```

### `stringifyPath(path)`

Convert various path formats to their string representation.

This function can handle JSONMatch AST nodes, Path arrays, and string expressions.
It's useful for normalizing different path formats into a consistent string format.

```javascript
import {parsePath, stringifyPath} from '@sanity/json-match'

// Convert AST back to string
const ast = parsePath('users[age > 21].name')
const str = stringifyPath(ast) // "users[age>21].name"

// Convert Path array to string
const pathArr = ['users', 0, {_key: 'profile'}, 'email']
const pathStr = stringifyPath(pathArr) // "users[0][_key==\"profile\"].email"

// String expressions are returned unchanged
const existing = 'items[*].name'
const result = stringifyPath(existing) // "items[*].name" (same string)

// Useful for normalizing expressions
const normalized = stringifyPath(parsePath('  users  [  age  >  21  ] . name  '))
console.log(normalized) // "users[age>21].name"
```

### `getIndexForKey(array, key)`

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

### `getPathDepth(path)`

Calculates the number of segments in a path.

```javascript
import {getPathDepth} from '@sanity/json-match'

getPathDepth('user.profile.email') // 3
getPathDepth('items[0].name') // 3
getPathDepth(['users', {_key: 'alice'}]) // 2
```

### `joinPaths(base, path)`

Joins two path segments into a single path string.

```javascript
import {joinPaths} from '@sanity/json-match'

// Adding properties
joinPaths('user', 'profile') // 'user.profile'

// Chaining operations
let path = 'data'
path = joinPaths(path, 'users') // 'data.users'
path = joinPaths(path, '[0]') // 'data.users[0]'
```

### `parsePath(input)`

Parse various path formats into a standardized AST.

```javascript
import {parsePath} from '@sanity/json-match'

// String expressions
parsePath('user.profile.email')

// Path arrays
parsePath(['users', 0, {_key: 'profile'}, 'email'])

// Already parsed AST (returns unchanged)
const ast = parsePath('items[*]')
parsePath(ast) === ast // true
```

### `slicePath(path, start?, end?)`

Extracts a section of a path, similar to `Array.prototype.slice`.

```javascript
import {slicePath} from '@sanity/json-match'

slicePath('a.b.c.d.e', 1, 4) // 'b.c.d'

// Get parent path
slicePath('user.profile.email', 0, -1) // 'user.profile'

// Get last segment
slicePath('items[0].name', -1) // 'name'
```

## LICENSE

MIT License - see [LICENSE](./LICENSE) file for details.
