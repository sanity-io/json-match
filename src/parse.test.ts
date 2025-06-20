import { describe, test, expect } from 'vitest';
import { parse } from './parse';

describe('Basic Expression Types', () => {
  test('parses simple identifier', () => {
    const ast = parse('name');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "name": "name",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses standalone number literal', () => {
    const ast = parse('42');
    expect(ast).toMatchInlineSnapshot(`
      {
        "type": "Number",
        "value": 42,
      }
    `);
  });

  test('parses negative number literal', () => {
    const ast = parse('-17');
    expect(ast).toMatchInlineSnapshot(`
      {
        "type": "Number",
        "value": -17,
      }
    `);
  });

  test('parses float literal', () => {
    const ast = parse('3.14');
    expect(ast).toMatchInlineSnapshot(`
      {
        "type": "Number",
        "value": 3.14,
      }
    `);
  });
});

describe('Simple Path Expressions', () => {
  test('parses single identifier', () => {
    const ast = parse('user');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "name": "user",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses quoted identifier', () => {
    const ast = parse("'user-data'");
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "name": "user-data",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses wildcard', () => {
    const ast = parse('*');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "type": "Wildcard",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses this context with $', () => {
    const ast = parse('$');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "type": "This",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses this context with @', () => {
    const ast = parse('@');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "type": "This",
        },
        "type": "PathExpression",
      }
    `);
  });
});

describe('Dot Notation Path Expressions', () => {
  test('parses simple dot access', () => {
    const ast = parse('user.name');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "user",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "name",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses nested dot access', () => {
    const ast = parse('user.profile.email');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "name": "user",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "name": "profile",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "email",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses recursive descent', () => {
    const ast = parse('data..name');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "data",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": true,
        "segment": {
          "name": "name",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses mixed dot and recursive descent', () => {
    const ast = parse('root.data..items.name');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "base": {
              "segment": {
                "name": "root",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            "recursive": false,
            "segment": {
              "name": "data",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": true,
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "name",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });
});

describe('Implicit Root Access', () => {
  test('parses implicit root with dot', () => {
    const ast = parse('.bicycle');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "type": "This",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "bicycle",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses implicit root with recursive descent', () => {
    const ast = parse('..price');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "type": "This",
          },
          "type": "PathExpression",
        },
        "recursive": true,
        "segment": {
          "name": "price",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses bare recursive descent', () => {
    const ast = parse('..');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "type": "This",
          },
          "type": "PathExpression",
        },
        "recursive": true,
        "segment": {
          "type": "Wildcard",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses implicit root with nested path', () => {
    const ast = parse('.bicycle.brand');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "type": "This",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "name": "bicycle",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "brand",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses implicit root with wildcard', () => {
    const ast = parse('.bicycle.*');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "type": "This",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "name": "bicycle",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "type": "Wildcard",
        },
        "type": "PathExpression",
      }
    `);
  });
});

describe('Array Access and Subscripts', () => {
  test('parses array index', () => {
    const ast = parse('items[0]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "type": "Number",
              "value": 0,
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses negative array index', () => {
    const ast = parse('items[-1]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "type": "Number",
              "value": -1,
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses array slice with start and end', () => {
    const ast = parse('items[1:3]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "end": 3,
              "start": 1,
              "type": "Slice",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses array slice with start only', () => {
    const ast = parse('items[2:]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "start": 2,
              "type": "Slice",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses array slice with end only', () => {
    const ast = parse('items[:3]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "end": 3,
              "type": "Slice",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses empty slice (wildcard equivalent)', () => {
    const ast = parse('items[:]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "segment": {
                "type": "Wildcard",
              },
              "type": "PathExpression",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses wildcard in brackets', () => {
    const ast = parse('items[*]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "segment": {
                "type": "Wildcard",
              },
              "type": "PathExpression",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses multiple indices', () => {
    const ast = parse('items[0, 2, 4]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "type": "Number",
              "value": 0,
            },
            {
              "type": "Number",
              "value": 2,
            },
            {
              "type": "Number",
              "value": 4,
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses mixed slices and indices', () => {
    const ast = parse('items[1:3, 5, 7:9]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "end": 3,
              "start": 1,
              "type": "Slice",
            },
            {
              "type": "Number",
              "value": 5,
            },
            {
              "end": 9,
              "start": 7,
              "type": "Slice",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });
});

describe('Constraints and Filtering', () => {
  test('parses simple comparison constraint', () => {
    const ast = parse('users[age > 21]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "users",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "age",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": ">",
              "right": {
                "type": "Number",
                "value": 21,
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses equality constraint with string', () => {
    const ast = parse('items[status == "active"]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "status",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "==",
              "right": {
                "type": "String",
                "value": "active",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses constraint with float', () => {
    const ast = parse('products[price <= 99.99]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "products",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "price",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "<=",
              "right": {
                "type": "Number",
                "value": 99.99,
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses existence constraint', () => {
    const ast = parse('users[email?]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "users",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "base": {
                "segment": {
                  "name": "email",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "type": "Existence",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses multiple constraints (OR logic)', () => {
    const ast = parse('friends[age > 35, favoriteColor == "blue"]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "friends",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "age",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": ">",
              "right": {
                "type": "Number",
                "value": 35,
              },
              "type": "Comparison",
            },
            {
              "left": {
                "segment": {
                  "name": "favoriteColor",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "==",
              "right": {
                "type": "String",
                "value": "blue",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses multiple constraints chained (AND logic)', () => {
    const ast = parse('friends[age > 35][favoriteColor == "blue"]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "name": "friends",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "elements": [
              {
                "left": {
                  "segment": {
                    "name": "age",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                "operator": ">",
                "right": {
                  "type": "Number",
                  "value": 35,
                },
                "type": "Comparison",
              },
            ],
            "type": "Subscript",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "favoriteColor",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "==",
              "right": {
                "type": "String",
                "value": "blue",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses constraint with item context @', () => {
    const ast = parse('[@ > 10]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "type": "This",
                },
                "type": "PathExpression",
              },
              "operator": ">",
              "right": {
                "type": "Number",
                "value": 10,
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses constraint with item context $', () => {
    const ast = parse('[$ == @]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "type": "This",
                },
                "type": "PathExpression",
              },
              "operator": "==",
              "right": {
                "segment": {
                  "type": "This",
                },
                "type": "PathExpression",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses constraint with path expression operand', () => {
    const ast = parse('items[price > parent.budget]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "price",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": ">",
              "right": {
                "base": {
                  "segment": {
                    "name": "parent",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                "recursive": false,
                "segment": {
                  "name": "budget",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });
});

describe('Expression Unions', () => {
  test('parses simple expression union', () => {
    const ast = parse('[name, email]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "elements": [
            {
              "segment": {
                "name": "name",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            {
              "segment": {
                "name": "email",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses union with different expression types', () => {
    const ast = parse('[user.name, contactInfo.email]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "elements": [
            {
              "base": {
                "segment": {
                  "name": "user",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "recursive": false,
              "segment": {
                "name": "name",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            {
              "base": {
                "segment": {
                  "name": "contactInfo",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "recursive": false,
              "segment": {
                "name": "email",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses nested expression union', () => {
    const ast = parse('[users[*].name, [config.version, data.timestamp]]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "elements": [
            {
              "base": {
                "base": {
                  "segment": {
                    "name": "users",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                "recursive": false,
                "segment": {
                  "elements": [
                    {
                      "segment": {
                        "type": "Wildcard",
                      },
                      "type": "PathExpression",
                    },
                  ],
                  "type": "Subscript",
                },
                "type": "PathExpression",
              },
              "recursive": false,
              "segment": {
                "name": "name",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            {
              "segment": {
                "elements": [
                  {
                    "base": {
                      "segment": {
                        "name": "config",
                        "type": "Identifier",
                      },
                      "type": "PathExpression",
                    },
                    "recursive": false,
                    "segment": {
                      "name": "version",
                      "type": "Identifier",
                    },
                    "type": "PathExpression",
                  },
                  {
                    "base": {
                      "segment": {
                        "name": "data",
                        "type": "Identifier",
                      },
                      "type": "PathExpression",
                    },
                    "recursive": false,
                    "segment": {
                      "name": "timestamp",
                      "type": "Identifier",
                    },
                    "type": "PathExpression",
                  },
                ],
                "type": "Subscript",
              },
              "type": "PathExpression",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses complex nested union from spec', () => {
    const ast = parse('[zargh,blagh,fnargh[1,2,3]]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "elements": [
            {
              "segment": {
                "name": "zargh",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            {
              "segment": {
                "name": "blagh",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            {
              "base": {
                "segment": {
                  "name": "fnargh",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "recursive": false,
              "segment": {
                "elements": [
                  {
                    "type": "Number",
                    "value": 1,
                  },
                  {
                    "type": "Number",
                    "value": 2,
                  },
                  {
                    "type": "Number",
                    "value": 3,
                  },
                ],
                "type": "Subscript",
              },
              "type": "PathExpression",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });
});

describe('Complex Path Expressions', () => {
  test('parses path with subscript followed by property', () => {
    const ast = parse('friends[0].name');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "name": "friends",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "elements": [
              {
                "type": "Number",
                "value": 0,
              },
            ],
            "type": "Subscript",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "name",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses path with constraint followed by property', () => {
    const ast = parse('friends[age > 35].name');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "name": "friends",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "elements": [
              {
                "left": {
                  "segment": {
                    "name": "age",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                "operator": ">",
                "right": {
                  "type": "Number",
                  "value": 35,
                },
                "type": "Comparison",
              },
            ],
            "type": "Subscript",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "name",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses path with wildcard followed by property', () => {
    const ast = parse('friends[*].name');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "name": "friends",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "elements": [
              {
                "segment": {
                  "type": "Wildcard",
                },
                "type": "PathExpression",
              },
            ],
            "type": "Subscript",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "name",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses quoted identifiers with special characters', () => {
    const ast = parse("'user-data'['first-name']");
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "user-data",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "segment": {
                "name": "first-name",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses mixed subscript content with slice and constraint', () => {
    const ast = parse('products[1:3, price > 500]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "products",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "end": 3,
              "start": 1,
              "type": "Slice",
            },
            {
              "left": {
                "segment": {
                  "name": "price",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": ">",
              "right": {
                "type": "Number",
                "value": 500,
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses mixed chained fields, indexes, slices, and constraints', () => {
    const ast = parse('products[1:3].foo[price > 100].bar[baz]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "base": {
              "base": {
                "base": {
                  "segment": {
                    "name": "products",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                "recursive": false,
                "segment": {
                  "elements": [
                    {
                      "end": 3,
                      "start": 1,
                      "type": "Slice",
                    },
                  ],
                  "type": "Subscript",
                },
                "type": "PathExpression",
              },
              "recursive": false,
              "segment": {
                "name": "foo",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            "recursive": false,
            "segment": {
              "elements": [
                {
                  "left": {
                    "segment": {
                      "name": "price",
                      "type": "Identifier",
                    },
                    "type": "PathExpression",
                  },
                  "operator": ">",
                  "right": {
                    "type": "Number",
                    "value": 100,
                  },
                  "type": "Comparison",
                },
              ],
              "type": "Subscript",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "name": "bar",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "segment": {
                "name": "baz",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });
});

describe('All Operators', () => {
  test('parses equality operator', () => {
    const ast = parse('items[status == "active"]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "status",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "==",
              "right": {
                "type": "String",
                "value": "active",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses inequality operator', () => {
    const ast = parse('items[status != "inactive"]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "status",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "!=",
              "right": {
                "type": "String",
                "value": "inactive",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses greater than operator', () => {
    const ast = parse('users[age > 21]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "users",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "age",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": ">",
              "right": {
                "type": "Number",
                "value": 21,
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses less than operator', () => {
    const ast = parse('users[age < 65]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "users",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "age",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "<",
              "right": {
                "type": "Number",
                "value": 65,
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses greater than or equal operator', () => {
    const ast = parse('users[age >= 18]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "users",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "age",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": ">=",
              "right": {
                "type": "Number",
                "value": 18,
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses less than or equal operator', () => {
    const ast = parse('products[price <= 100]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "products",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "price",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "<=",
              "right": {
                "type": "Number",
                "value": 100,
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });
});

describe('String Literals and Escaping', () => {
  test('parses constraint with simple string', () => {
    const ast = parse('items[name == "simple"]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "name",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "==",
              "right": {
                "type": "String",
                "value": "simple",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses constraint with escaped quotes', () => {
    const ast = parse('items[name == "escaped \\"quotes\\""]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "name",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "==",
              "right": {
                "type": "String",
                "value": "escaped "quotes"",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses constraint with escaped backslashes', () => {
    const ast = parse('items[path == "C:\\\\Program Files"]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "path",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "==",
              "right": {
                "type": "String",
                "value": "C:\\Program Files",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses constraint with Unicode escape', () => {
    const ast = parse('items[name == "\\u00E5bc"]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "name",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": "==",
              "right": {
                "type": "String",
                "value": "åbc",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses quoted identifier with escaped quotes', () => {
    const ast = parse("'escaped \\'quotes\\''.field");
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "escaped 'quotes'",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "field",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });
});

describe('Real JSONMatch Examples from Spec', () => {
  test('parses friends constraint from spec', () => {
    const ast = parse('friends[age > 35].name');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "name": "friends",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "elements": [
              {
                "left": {
                  "segment": {
                    "name": "age",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                "operator": ">",
                "right": {
                  "type": "Number",
                  "value": 35,
                },
                "type": "Comparison",
              },
            ],
            "type": "Subscript",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "name",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses multiple constraints from spec', () => {
    const ast = parse('friends[age > 30, favoriteColor == "blue"].name');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "name": "friends",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "elements": [
              {
                "left": {
                  "segment": {
                    "name": "age",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                "operator": ">",
                "right": {
                  "type": "Number",
                  "value": 30,
                },
                "type": "Comparison",
              },
              {
                "left": {
                  "segment": {
                    "name": "favoriteColor",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                "operator": "==",
                "right": {
                  "type": "String",
                  "value": "blue",
                },
                "type": "Comparison",
              },
            ],
            "type": "Subscript",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "name",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses existence constraint from spec', () => {
    const ast = parse('friends[age?].age');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "name": "friends",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "elements": [
              {
                "base": {
                  "segment": {
                    "name": "age",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                "type": "Existence",
              },
            ],
            "type": "Subscript",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "age",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses recursive descent from spec', () => {
    const ast = parse('contactInfo..shortName');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "contactInfo",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": true,
        "segment": {
          "name": "shortName",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses union from spec', () => {
    const ast = parse('[contactInfo.state.shortName, roles]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "elements": [
            {
              "base": {
                "base": {
                  "segment": {
                    "name": "contactInfo",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                "recursive": false,
                "segment": {
                  "name": "state",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "recursive": false,
              "segment": {
                "name": "shortName",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            {
              "segment": {
                "name": "roles",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses item context from spec', () => {
    const ast = parse('friends.age[@ > 35]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "name": "friends",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "name": "age",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "type": "This",
                },
                "type": "PathExpression",
              },
              "operator": ">",
              "right": {
                "type": "Number",
                "value": 35,
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses implicit root wildcard from spec', () => {
    const ast = parse('.bicycle.*');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "type": "This",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "name": "bicycle",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "type": "Wildcard",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses mixed array access from spec', () => {
    const ast = parse("a['c','b','array'].d.e");
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "base": {
              "segment": {
                "name": "a",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            "recursive": false,
            "segment": {
              "elements": [
                {
                  "segment": {
                    "name": "c",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                {
                  "segment": {
                    "name": "b",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                {
                  "segment": {
                    "name": "array",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
              ],
              "type": "Subscript",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "name": "d",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "e",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses complex union with subscripts from spec', () => {
    const ast = parse('[zargh,blagh,fnargh[1,2,3]]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "elements": [
            {
              "segment": {
                "name": "zargh",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            {
              "segment": {
                "name": "blagh",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            {
              "base": {
                "segment": {
                  "name": "fnargh",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "recursive": false,
              "segment": {
                "elements": [
                  {
                    "type": "Number",
                    "value": 1,
                  },
                  {
                    "type": "Number",
                    "value": 2,
                  },
                  {
                    "type": "Number",
                    "value": 3,
                  },
                ],
                "type": "Subscript",
              },
              "type": "PathExpression",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });
});

describe('Edge Cases and Complex Expressions', () => {
  test('parses path starting with This context', () => {
    const ast = parse('$.config.version');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "type": "This",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "name": "config",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "name": "version",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses nested subscripts', () => {
    const ast = parse('matrix[0][1]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "segment": {
              "name": "matrix",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": false,
          "segment": {
            "elements": [
              {
                "type": "Number",
                "value": 0,
              },
            ],
            "type": "Subscript",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "type": "Number",
              "value": 1,
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses constraint with nested path in operand', () => {
    const ast = parse('items[price > config.maxPrice]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": false,
        "segment": {
          "elements": [
            {
              "left": {
                "segment": {
                  "name": "price",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "operator": ">",
              "right": {
                "base": {
                  "segment": {
                    "name": "config",
                    "type": "Identifier",
                  },
                  "type": "PathExpression",
                },
                "recursive": false,
                "segment": {
                  "name": "maxPrice",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "type": "Comparison",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses multiple levels of recursive descent', () => {
    const ast = parse('root..data..items..name');
    expect(ast).toMatchInlineSnapshot(`
      {
        "base": {
          "base": {
            "base": {
              "segment": {
                "name": "root",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            "recursive": true,
            "segment": {
              "name": "data",
              "type": "Identifier",
            },
            "type": "PathExpression",
          },
          "recursive": true,
          "segment": {
            "name": "items",
            "type": "Identifier",
          },
          "type": "PathExpression",
        },
        "recursive": true,
        "segment": {
          "name": "name",
          "type": "Identifier",
        },
        "type": "PathExpression",
      }
    `);
  });

  test('parses union with mixed implicit root expressions', () => {
    const ast = parse('[.bicycle.brand, ..price, name]');
    expect(ast).toMatchInlineSnapshot(`
      {
        "segment": {
          "elements": [
            {
              "base": {
                "base": {
                  "segment": {
                    "type": "This",
                  },
                  "type": "PathExpression",
                },
                "recursive": false,
                "segment": {
                  "name": "bicycle",
                  "type": "Identifier",
                },
                "type": "PathExpression",
              },
              "recursive": false,
              "segment": {
                "name": "brand",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            {
              "base": {
                "segment": {
                  "type": "This",
                },
                "type": "PathExpression",
              },
              "recursive": true,
              "segment": {
                "name": "price",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
            {
              "segment": {
                "name": "name",
                "type": "Identifier",
              },
              "type": "PathExpression",
            },
          ],
          "type": "Subscript",
        },
        "type": "PathExpression",
      }
    `);
  });
});

describe('Error Handling', () => {
  test('throws on empty expression', () => {
    expect(() => parse('')).toThrow('Empty expression');
  });

  test('throws on unexpected token', () => {
    expect(() => parse('name ]')).toThrow('Expected EOF');
  });

  test('throws on unterminated subscript', () => {
    expect(() => parse('items[0')).toThrow('Expected ]');
  });

  test('throws on invalid path segment', () => {
    expect(() => parse('.')).toThrow('Expected Path Segment');
  });

  test('throws on missing operand in constraint', () => {
    expect(() => parse('items[age >]')).toThrow();
  });

  test('throws on unterminated union', () => {
    expect(() => parse('[name, email')).toThrow('Expected ]');
  });
});

describe('Position Tracking in Errors', () => {
  test('reports correct position for unexpected tokens', () => {
    expect(() => parse('user.name ]')).toThrow(/position 10/);
  });

  test('reports correct position for missing brackets', () => {
    expect(() => parse('items[0')).toThrow(/position/);
  });

  test('reports correct position for invalid segments', () => {
    expect(() => parse('user.')).toThrow(/position/);
  });
});
