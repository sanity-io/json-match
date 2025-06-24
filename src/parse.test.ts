import {describe, test, expect} from 'vitest'
import {parse} from './parse'

describe('Basic Expression Types', () => {
  test('parses simple identifier', () => {
    const ast = parse('name')
    expect(ast).toEqual({
      type: 'Path',
      segment: {name: 'name', type: 'Identifier'},
    })
  })

  test('parses standalone number literal', () => {
    const ast = parse('42')
    expect(ast).toEqual({
      type: 'Number',
      value: 42,
    })
  })

  test('parses negative number literal', () => {
    const ast = parse('-17')
    expect(ast).toEqual({
      type: 'Number',
      value: -17,
    })
  })

  test('parses float literal', () => {
    const ast = parse('3.14')
    expect(ast).toEqual({
      type: 'Number',
      value: 3.14,
    })
  })

  test('parses true boolean literal', () => {
    const ast = parse('true')
    expect(ast).toEqual({
      type: 'Boolean',
      value: true,
    })
  })

  test('parses false boolean literal', () => {
    const ast = parse('false')
    expect(ast).toEqual({
      type: 'Boolean',
      value: false,
    })
  })
})

describe('Simple Path Expressions', () => {
  test('parses single identifier', () => {
    const ast = parse('user')
    expect(ast).toEqual({
      type: 'Path',
      segment: {name: 'user', type: 'Identifier'},
    })
  })

  test('parses quoted identifier', () => {
    const ast = parse("'user-data'")
    expect(ast).toEqual({
      type: 'Path',
      segment: {name: 'user-data', type: 'Identifier'},
    })
  })

  test('parses wildcard', () => {
    const ast = parse('*')
    expect(ast).toEqual({
      type: 'Path',
      segment: {type: 'Wildcard'},
    })
  })

  test('parses this context with $', () => {
    const ast = parse('$')
    expect(ast).toEqual({
      type: 'Path',
      segment: {type: 'This'},
    })
  })

  test('parses this context with @', () => {
    const ast = parse('@')
    expect(ast).toEqual({
      type: 'Path',
      segment: {type: 'This'},
    })
  })
})

describe('Dot Notation Path Expressions', () => {
  test('parses simple dot access', () => {
    const ast = parse('user.name')
    expect(ast).toEqual({
      type: 'Path',
      recursive: false,
      base: {
        segment: {name: 'user', type: 'Identifier'},
        type: 'Path',
      },
      segment: {name: 'name', type: 'Identifier'},
    })
  })

  test('parses nested dot access', () => {
    const ast = parse('user.profile.email')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {
          type: 'Path',
          segment: {name: 'user', type: 'Identifier'},
        },
        recursive: false,
        segment: {name: 'profile', type: 'Identifier'},
      },
      recursive: false,
      segment: {name: 'email', type: 'Identifier'},
    })
  })

  test('parses recursive descent', () => {
    const ast = parse('data..name')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        segment: {name: 'data', type: 'Identifier'},
      },
      recursive: true,
      segment: {name: 'name', type: 'Identifier'},
    })
  })

  test('parses mixed dot and recursive descent', () => {
    const ast = parse('root.data..items.name')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {
          type: 'Path',
          base: {
            type: 'Path',
            segment: {name: 'root', type: 'Identifier'},
          },
          recursive: false,
          segment: {name: 'data', type: 'Identifier'},
        },
        recursive: true,
        segment: {name: 'items', type: 'Identifier'},
      },
      recursive: false,
      segment: {name: 'name', type: 'Identifier'},
    })
  })
})

describe('Implicit This Access', () => {
  test('parses implicit this with dot', () => {
    const ast = parse('.bicycle')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        segment: {type: 'This'},
      },
      recursive: false,
      segment: {name: 'bicycle', type: 'Identifier'},
    })
  })

  test('parses implicit this with recursive descent', () => {
    const ast = parse('..price')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {type: 'This'}},
      recursive: true,
      segment: {name: 'price', type: 'Identifier'},
    })
  })

  test('parses bare recursive descent', () => {
    const ast = parse('..')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {type: 'This'}},
      recursive: true,
      segment: {type: 'Wildcard'},
    })
  })

  test('parses implicit this with nested path', () => {
    const ast = parse('.bicycle.brand')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        base: {type: 'Path', segment: {type: 'This'}},
        recursive: false,
        segment: {name: 'bicycle', type: 'Identifier'},
        type: 'Path',
      },
      recursive: false,
      segment: {name: 'brand', type: 'Identifier'},
    })
  })

  test('parses implicit this with wildcard', () => {
    const ast = parse('.bicycle.*')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {type: 'Path', segment: {type: 'This'}},
        recursive: false,
        segment: {name: 'bicycle', type: 'Identifier'},
      },
      recursive: false,
      segment: {type: 'Wildcard'},
    })
  })
})

describe('Array Access and Subscripts', () => {
  test('parses array index', () => {
    const ast = parse('items[0]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {type: 'Subscript', elements: [{type: 'Number', value: 0}]},
    })
  })

  test('parses negative array index', () => {
    const ast = parse('items[-1]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [{type: 'Number', value: -1}],
      },
    })
  })

  test('parses array slice with start and end', () => {
    const ast = parse('items[1:3]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {type: 'Subscript', elements: [{type: 'Slice', start: 1, end: 3}]},
    })
  })

  test('parses array slice with start only', () => {
    const ast = parse('items[2:]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {type: 'Subscript', elements: [{type: 'Slice', start: 2}]},
    })
  })

  test('parses array slice with end only', () => {
    const ast = parse('items[:3]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {type: 'Subscript', elements: [{type: 'Slice', end: 3}]},
    })
  })

  test('parses empty slice (wildcard equivalent)', () => {
    const ast = parse('items[:]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {type: 'Identifier', name: 'items'}},
      recursive: false,
      segment: {type: 'Subscript', elements: [{type: 'Path', segment: {type: 'Wildcard'}}]},
    })
  })

  test('parses wildcard in brackets', () => {
    const ast = parse('items[*]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {type: 'Subscript', elements: [{type: 'Path', segment: {type: 'Wildcard'}}]},
    })
  })

  test('parses multiple indices', () => {
    const ast = parse('items[0, 2, 4]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {type: 'Number', value: 0},
          {type: 'Number', value: 2},
          {type: 'Number', value: 4},
        ],
      },
    })
  })

  test('parses mixed slices and indices', () => {
    const ast = parse('items[1:3, 5, 7:9]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {type: 'Slice', start: 1, end: 3},
          {type: 'Number', value: 5},
          {type: 'Slice', start: 7, end: 9},
        ],
      },
    })
  })
})

describe('Constraints and Filtering', () => {
  test('parses simple comparison constraint', () => {
    const ast = parse('users[age > 21]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {type: 'Identifier', name: 'users'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {segment: {type: 'Identifier', name: 'age'}, type: 'Path'},
            operator: '>',
            right: {type: 'Number', value: 21},
          },
        ],
      },
    })
  })

  test('parses equality constraint with string', () => {
    const ast = parse('items[status == "active"]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {type: 'Identifier', name: 'items'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {segment: {type: 'Identifier', name: 'status'}, type: 'Path'},
            operator: '==',
            right: {type: 'String', value: 'active'},
          },
        ],
      },
    })
  })

  test('parses constraint with float', () => {
    const ast = parse('products[price <= 99.99]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {type: 'Identifier', name: 'products'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {type: 'Identifier', name: 'price'}},
            operator: '<=',
            right: {type: 'Number', value: 99.99},
          },
        ],
      },
    })
  })

  test('parses existence constraint', () => {
    const ast = parse('users[email?]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {type: 'Identifier', name: 'users'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {type: 'Existence', base: {type: 'Path', segment: {type: 'Identifier', name: 'email'}}},
        ],
      },
    })
  })

  test('parses multiple constraints (OR logic)', () => {
    const ast = parse('friends[age > 35, favoriteColor == "blue"]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'friends', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {type: 'Identifier', name: 'age'}},
            operator: '>',
            right: {type: 'Number', value: 35},
          },
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {type: 'Identifier', name: 'favoriteColor'}},
            operator: '==',
            right: {type: 'String', value: 'blue'},
          },
        ],
      },
    })
  })

  test('parses multiple constraints chained (AND logic)', () => {
    const ast = parse('friends[age > 35][favoriteColor == "blue"]')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {type: 'Path', segment: {type: 'Identifier', name: 'friends'}},
        recursive: false,
        segment: {
          type: 'Subscript',
          elements: [
            {
              type: 'Comparison',
              left: {type: 'Path', segment: {type: 'Identifier', name: 'age'}},
              operator: '>',
              right: {type: 'Number', value: 35},
            },
          ],
        },
      },
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {type: 'Identifier', name: 'favoriteColor'}},
            operator: '==',
            right: {type: 'String', value: 'blue'},
          },
        ],
      },
    })
  })

  test('parses constraint with item context @', () => {
    const ast = parse('[@ > 10]')
    expect(ast).toEqual({
      type: 'Path',
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {type: 'This'}},
            operator: '>',
            right: {type: 'Number', value: 10},
          },
        ],
      },
    })
  })

  test('parses constraint with item context $', () => {
    const ast = parse('[$ == @]')
    expect(ast).toEqual({
      type: 'Path',
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {type: 'This'}},
            operator: '==',
            right: {type: 'Path', segment: {type: 'This'}},
          },
        ],
      },
    })
  })

  test('parses constraint with path expression operand', () => {
    const ast = parse('items[price > parent.budget]')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        segment: {name: 'items', type: 'Identifier'},
      },
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'price', type: 'Identifier'}},
            operator: '>',
            right: {
              type: 'Path',
              base: {type: 'Path', segment: {name: 'parent', type: 'Identifier'}},
              recursive: false,
              segment: {name: 'budget', type: 'Identifier'},
            },
          },
        ],
      },
    })
  })
})

describe('Expression Unions', () => {
  test('parses simple expression union', () => {
    const ast = parse('[name, email]')
    expect(ast).toEqual({
      type: 'Path',
      segment: {
        type: 'Subscript',
        elements: [
          {type: 'Path', segment: {name: 'name', type: 'Identifier'}},
          {type: 'Path', segment: {name: 'email', type: 'Identifier'}},
        ],
      },
    })
  })

  test('parses union with different expression types', () => {
    const ast = parse('[user.name, contactInfo.email]')
    expect(ast).toEqual({
      type: 'Path',
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Path',
            base: {type: 'Path', segment: {name: 'user', type: 'Identifier'}},
            recursive: false,
            segment: {name: 'name', type: 'Identifier'},
          },
          {
            type: 'Path',
            base: {type: 'Path', segment: {name: 'contactInfo', type: 'Identifier'}},
            recursive: false,
            segment: {name: 'email', type: 'Identifier'},
          },
        ],
      },
    })
  })

  test('parses nested expression union', () => {
    const ast = parse('[users[*].name, [config.version, data.timestamp]]')
    expect(ast).toEqual({
      type: 'Path',
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Path',
            base: {
              type: 'Path',
              base: {type: 'Path', segment: {name: 'users', type: 'Identifier'}},
              recursive: false,
              segment: {
                type: 'Subscript',
                elements: [{type: 'Path', segment: {type: 'Wildcard'}}],
              },
            },
            recursive: false,
            segment: {name: 'name', type: 'Identifier'},
          },
          {
            type: 'Path',
            segment: {
              type: 'Subscript',
              elements: [
                {
                  type: 'Path',
                  base: {type: 'Path', segment: {name: 'config', type: 'Identifier'}},
                  recursive: false,
                  segment: {name: 'version', type: 'Identifier'},
                },
                {
                  type: 'Path',
                  base: {type: 'Path', segment: {name: 'data', type: 'Identifier'}},
                  recursive: false,
                  segment: {name: 'timestamp', type: 'Identifier'},
                },
              ],
            },
          },
        ],
      },
    })
  })

  test('parses complex nested union from spec', () => {
    const ast = parse('[zargh,blagh,fnargh[1,2,3]]')
    expect(ast).toEqual({
      type: 'Path',
      segment: {
        type: 'Subscript',
        elements: [
          {type: 'Path', segment: {name: 'zargh', type: 'Identifier'}},
          {type: 'Path', segment: {name: 'blagh', type: 'Identifier'}},
          {
            type: 'Path',
            base: {type: 'Path', segment: {name: 'fnargh', type: 'Identifier'}},
            recursive: false,
            segment: {
              type: 'Subscript',
              elements: [
                {type: 'Number', value: 1},
                {type: 'Number', value: 2},
                {type: 'Number', value: 3},
              ],
            },
          },
        ],
      },
    })
  })
})

describe('Complex Path Expressions', () => {
  test('parses path with subscript followed by property', () => {
    const ast = parse('friends[0].name')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {type: 'Path', segment: {name: 'friends', type: 'Identifier'}},
        recursive: false,
        segment: {type: 'Subscript', elements: [{type: 'Number', value: 0}]},
      },
      recursive: false,
      segment: {name: 'name', type: 'Identifier'},
    })
  })

  test('parses path with constraint followed by property', () => {
    const ast = parse('friends[age > 35].name')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {type: 'Path', segment: {name: 'friends', type: 'Identifier'}},
        recursive: false,
        segment: {
          type: 'Subscript',
          elements: [
            {
              type: 'Comparison',
              left: {type: 'Path', segment: {name: 'age', type: 'Identifier'}},
              operator: '>',
              right: {type: 'Number', value: 35},
            },
          ],
        },
      },
      recursive: false,
      segment: {name: 'name', type: 'Identifier'},
    })
  })

  test('parses path with wildcard followed by property', () => {
    const ast = parse('friends[*].name')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {type: 'Path', segment: {name: 'friends', type: 'Identifier'}},
        recursive: false,
        segment: {
          type: 'Subscript',
          elements: [{type: 'Path', segment: {type: 'Wildcard'}}],
        },
      },
      recursive: false,
      segment: {name: 'name', type: 'Identifier'},
    })
  })

  test('parses quoted identifiers with special characters', () => {
    const ast = parse("'user-data'['first-name']")
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'user-data', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [{type: 'Path', segment: {name: 'first-name', type: 'Identifier'}}],
      },
    })
  })

  test('parses mixed subscript content with slice and constraint', () => {
    const ast = parse('products[1:3, price > 500]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'products', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {type: 'Slice', start: 1, end: 3},
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'price', type: 'Identifier'}},
            operator: '>',
            right: {type: 'Number', value: 500},
          },
        ],
      },
    })
  })

  test('parses mixed chained fields, indexes, slices, and constraints', () => {
    const ast = parse('products[1:3].foo[price > 100].bar[baz]')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {
          type: 'Path',
          base: {
            type: 'Path',
            base: {
              type: 'Path',
              base: {type: 'Path', segment: {name: 'products', type: 'Identifier'}},
              recursive: false,
              segment: {type: 'Subscript', elements: [{type: 'Slice', start: 1, end: 3}]},
            },
            recursive: false,
            segment: {name: 'foo', type: 'Identifier'},
          },
          recursive: false,
          segment: {
            type: 'Subscript',
            elements: [
              {
                type: 'Comparison',
                left: {type: 'Path', segment: {name: 'price', type: 'Identifier'}},
                operator: '>',
                right: {type: 'Number', value: 100},
              },
            ],
          },
        },
        recursive: false,
        segment: {name: 'bar', type: 'Identifier'},
      },
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [{type: 'Path', segment: {name: 'baz', type: 'Identifier'}}],
      },
    })
  })

  test('parses mixed array access with quoted identifiers', () => {
    const ast = parse("a['c','b','array'].d.e")
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {
          type: 'Path',
          base: {type: 'Path', segment: {name: 'a', type: 'Identifier'}},
          recursive: false,
          segment: {
            type: 'Subscript',
            elements: [
              {type: 'Path', segment: {name: 'c', type: 'Identifier'}},
              {type: 'Path', segment: {name: 'b', type: 'Identifier'}},
              {type: 'Path', segment: {name: 'array', type: 'Identifier'}},
            ],
          },
        },
        recursive: false,
        segment: {name: 'd', type: 'Identifier'},
      },
      recursive: false,
      segment: {name: 'e', type: 'Identifier'},
    })
  })
})

describe('All Operators', () => {
  test('parses equality operator', () => {
    const ast = parse('items[status == "active"]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'status', type: 'Identifier'}},
            operator: '==',
            right: {type: 'String', value: 'active'},
          },
        ],
      },
    })
  })

  test('parses inequality operator', () => {
    const ast = parse('items[status != "inactive"]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'status', type: 'Identifier'}},
            operator: '!=',
            right: {type: 'String', value: 'inactive'},
          },
        ],
      },
    })
  })

  test('parses greater than operator', () => {
    const ast = parse('users[age > 21]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'users', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'age', type: 'Identifier'}},
            operator: '>',
            right: {type: 'Number', value: 21},
          },
        ],
      },
    })
  })

  test('parses less than operator', () => {
    const ast = parse('users[age < 65]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'users', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'age', type: 'Identifier'}},
            operator: '<',
            right: {type: 'Number', value: 65},
          },
        ],
      },
    })
  })

  test('parses greater than or equal operator', () => {
    const ast = parse('users[age >= 18]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'users', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'age', type: 'Identifier'}},
            operator: '>=',
            right: {type: 'Number', value: 18},
          },
        ],
      },
    })
  })

  test('parses less than or equal operator', () => {
    const ast = parse('products[price <= 100]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'products', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'price', type: 'Identifier'}},
            operator: '<=',
            right: {type: 'Number', value: 100},
          },
        ],
      },
    })
  })
})

describe('Literals and Escaping', () => {
  test('parses constraint with simple string', () => {
    const ast = parse('items[name == "simple"]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'name', type: 'Identifier'}},
            operator: '==',
            right: {type: 'String', value: 'simple'},
          },
        ],
      },
    })
  })

  test('parses boolean literals in expressions', () => {
    const ast = parse('items[active == true]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'active', type: 'Identifier'}},
            operator: '==',
            right: {type: 'Boolean', value: true},
          },
        ],
      },
    })
  })

  test('parses boolean literals with false', () => {
    const ast = parse('items[hidden != false]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'hidden', type: 'Identifier'}},
            operator: '!=',
            right: {type: 'Boolean', value: false},
          },
        ],
      },
    })
  })

  test('parses mixed boolean expressions', () => {
    const ast = parse('[true, false, active == true]')
    expect(ast).toEqual({
      type: 'Path',
      segment: {
        type: 'Subscript',
        elements: [
          {type: 'Boolean', value: true},
          {type: 'Boolean', value: false},
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'active', type: 'Identifier'}},
            operator: '==',
            right: {type: 'Boolean', value: true},
          },
        ],
      },
    })
  })

  test('parses constraint with escaped quotes', () => {
    const ast = parse('items[name == "escaped \\"quotes\\""]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'name', type: 'Identifier'}},
            operator: '==',
            right: {type: 'String', value: 'escaped "quotes"'},
          },
        ],
      },
    })
  })

  test('parses constraint with escaped backslashes', () => {
    const ast = parse('items[path == "C:\\\\Program Files"]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'path', type: 'Identifier'}},
            operator: '==',
            right: {type: 'String', value: 'C:\\Program Files'},
          },
        ],
      },
    })
  })

  test('parses constraint with Unicode escape', () => {
    const ast = parse('items[name == "\\u00E5bc"]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'name', type: 'Identifier'}},
            operator: '==',
            right: {type: 'String', value: 'åbc'},
          },
        ],
      },
    })
  })

  test('parses quoted identifier with escaped quotes', () => {
    const ast = parse("'escaped \\'quotes\\''.field")
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: "escaped 'quotes'", type: 'Identifier'}},
      recursive: false,
      segment: {name: 'field', type: 'Identifier'},
    })
  })
})

describe('Edge Cases and Complex Expressions', () => {
  test('parses path starting with This context', () => {
    const ast = parse('$.config.version')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {type: 'Path', segment: {type: 'This'}},
        recursive: false,
        segment: {name: 'config', type: 'Identifier'},
      },
      recursive: false,
      segment: {name: 'version', type: 'Identifier'},
    })
  })

  test('parses nested subscripts', () => {
    const ast = parse('matrix[0][1]')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {type: 'Path', segment: {name: 'matrix', type: 'Identifier'}},
        recursive: false,
        segment: {type: 'Subscript', elements: [{type: 'Number', value: 0}]},
      },
      recursive: false,
      segment: {type: 'Subscript', elements: [{type: 'Number', value: 1}]},
    })
  })

  test('parses constraint with nested path in operand', () => {
    const ast = parse('items[price > config.maxPrice]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'price', type: 'Identifier'}},
            operator: '>',
            right: {
              type: 'Path',
              base: {type: 'Path', segment: {name: 'config', type: 'Identifier'}},
              recursive: false,
              segment: {name: 'maxPrice', type: 'Identifier'},
            },
          },
        ],
      },
    })
  })

  test('parses multiple levels of recursive descent', () => {
    const ast = parse('root..data..items..name')
    expect(ast).toEqual({
      type: 'Path',
      base: {
        type: 'Path',
        base: {
          type: 'Path',
          base: {type: 'Path', segment: {name: 'root', type: 'Identifier'}},
          recursive: true,
          segment: {name: 'data', type: 'Identifier'},
        },
        recursive: true,
        segment: {name: 'items', type: 'Identifier'},
      },
      recursive: true,
      segment: {name: 'name', type: 'Identifier'},
    })
  })

  test('parses union with mixed implicit root expressions', () => {
    const ast = parse('[.bicycle.brand, ..price, name]')
    expect(ast).toEqual({
      type: 'Path',
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Path',
            base: {
              type: 'Path',
              base: {type: 'Path', segment: {type: 'This'}},
              recursive: false,
              segment: {name: 'bicycle', type: 'Identifier'},
            },
            recursive: false,
            segment: {name: 'brand', type: 'Identifier'},
          },
          {
            type: 'Path',
            base: {type: 'Path', segment: {type: 'This'}},
            recursive: true,
            segment: {name: 'price', type: 'Identifier'},
          },
          {type: 'Path', segment: {name: 'name', type: 'Identifier'}},
        ],
      },
    })
  })

  test('does not parse string literals as paths', () => {
    expect(() => parse('some.path."invalid"')).toThrow('Expected Path Segment')
  })
})

describe('Error Handling', () => {
  test('throws on empty expression', () => {
    expect(() => parse('')).toThrow('Empty expression')
  })

  test('throws on unexpected token', () => {
    expect(() => parse('name ]')).toThrow('Expected EOF')
  })

  test('throws on unterminated subscript', () => {
    expect(() => parse('items[0')).toThrow('Expected ]')
  })

  test('throws on invalid path segment', () => {
    expect(() => parse('.')).toThrow('Expected Path Segment')
  })

  test('throws on missing operand in constraint', () => {
    expect(() => parse('items[age >]')).toThrow('Unexpected token ]')
  })

  test('throws on unterminated union', () => {
    expect(() => parse('[name, email')).toThrow('Expected ]')
  })
})

describe('Position Tracking in Errors', () => {
  test('reports correct position for unexpected tokens', () => {
    expect(() => parse('user.name ]')).toThrow(/position 10/)
  })

  test('reports correct position for missing brackets', () => {
    expect(() => parse('items[0')).toThrow(/position 7/)
  })

  test('reports correct position for invalid segments', () => {
    expect(() => parse('user.')).toThrow(/position 5/)
  })
})

describe('Null Literal', () => {
  test('parses standalone null literal', () => {
    const ast = parse('null')
    expect(ast).toEqual({type: 'Null'})
  })

  test('parses null in comparison constraint', () => {
    const ast = parse('items[value == null]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'value', type: 'Identifier'}},
            operator: '==',
            right: {type: 'Null'},
          },
        ],
      },
    })
  })

  test('parses null in union', () => {
    const ast = parse('[null, true, false]')
    expect(ast).toEqual({
      type: 'Path',
      segment: {
        type: 'Subscript',
        elements: [{type: 'Null'}, {type: 'Boolean', value: true}, {type: 'Boolean', value: false}],
      },
    })
  })

  test('parses null as a property value in comparison', () => {
    const ast = parse('items[property == null]')
    expect(ast).toEqual({
      type: 'Path',
      base: {type: 'Path', segment: {name: 'items', type: 'Identifier'}},
      recursive: false,
      segment: {
        type: 'Subscript',
        elements: [
          {
            type: 'Comparison',
            left: {type: 'Path', segment: {name: 'property', type: 'Identifier'}},
            operator: '==',
            right: {type: 'Null'},
          },
        ],
      },
    })
  })
})
