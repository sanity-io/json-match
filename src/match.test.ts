import { describe, test, expect } from 'vitest';
import { parse } from './parse';
import { match } from './match';

describe('Match Function', () => {
  const testData = {
    users: [
      { name: 'Alice', age: 25, email: 'alice@example.com', role: 'user' },
      { name: 'Bob', age: 30, email: 'bob@example.com', role: 'admin' },
      { name: 'Carol', age: 35, email: 'carol@example.com', role: 'admin' },
      { name: 'Jules', age: 44, role: 'user' },
    ],
    config: {
      maxUsers: 100,
      version: '1.0.0',
    },
    bicycle: {
      color: 'red',
      type: 'road',
    },
  };

  const keyedData = {
    items: [
      { _key: 'item1', name: 'First', price: 100 },
      { _key: 'item2', name: 'Second', price: 200 },
      { _key: 'item3', name: 'Third', price: 300 },
    ],
  };

  describe('Basic Path Expressions', () => {
    test('matches simple identifier', () => {
      const results = Array.from(
        match({ expression: 'users', value: testData }),
      );
      expect(results).toHaveLength(1);
      const { value, path } = results[0];
      expect(value).toBe(testData.users);
      expect(path).toEqual(['users']);
    });

    test('matches dot access', () => {
      const results = Array.from(
        match({ expression: 'config.version', value: testData }),
      );
      expect(results).toHaveLength(1);
      const { value, path } = results[0];
      expect(value).toBe('1.0.0');
      expect(path).toEqual(['config', 'version']);
    });

    test('matches nested dot access', () => {
      const results = Array.from(
        match({ expression: 'bicycle.color', value: testData }),
      );
      expect(results).toHaveLength(1);
      const { value, path } = results[0];
      expect(value).toBe('red');
      expect(path).toEqual(['bicycle', 'color']);
    });
  });

  describe('Implicit Root Access', () => {
    test('matches implicit root with dot', () => {
      const results = Array.from(
        match({ expression: '.bicycle', value: testData }),
      );
      expect(results).toHaveLength(1);
      const { value, path } = results[0];
      expect(value).toBe(testData.bicycle);
      expect(path).toEqual(['bicycle']);
    });

    test('matches implicit root with nested path', () => {
      const results = Array.from(
        match({ expression: '.bicycle.color', value: testData }),
      );
      expect(results).toHaveLength(1);
      const { value, path } = results[0];
      expect(value).toBe('red');
      expect(path).toEqual(['bicycle', 'color']);
    });

    test('matches bare recursive descent', () => {
      const results = Array.from(match({ expression: '..', value: testData }));
      expect(results).toHaveLength(1);
      const { value, path } = results[0];
      expect(value).toBe(testData);
      expect(path).toEqual([]);
    });
  });

  describe('Array Access', () => {
    test('matches array index', () => {
      const results = Array.from(
        match({ expression: 'users[0]', value: testData }),
      );
      expect(results).toHaveLength(1);
      const { value, path } = results[0];
      expect(value).toEqual({
        name: 'Alice',
        age: 25,
        email: 'alice@example.com',
        role: 'user',
      });
      expect(path).toEqual(['users', 0]);
    });

    test('matches negative array index', () => {
      const results = Array.from(
        match({ expression: 'users[-1]', value: testData }),
      );
      expect(results).toHaveLength(1);
      const { value, path } = results[0];
      expect(value).toEqual({
        name: 'Jules',
        age: 44,
        role: 'user',
      });
      expect(path).toEqual(['users', -1]);
    });

    test('matches array slice', () => {
      const results = Array.from(
        match({ expression: 'users[1:3]', value: testData }),
      );
      expect(results).toHaveLength(2);
      const first = results[0];
      const second = results[1];
      expect(first.value).toEqual({
        name: 'Bob',
        age: 30,
        email: 'bob@example.com',
        role: 'admin',
      });
      expect(first.path).toEqual(['users', 1]);
      expect(second.value).toEqual({
        name: 'Carol',
        age: 35,
        email: 'carol@example.com',
        role: 'admin',
      });
      expect(second.path).toEqual(['users', 2]);
    });

    test('matches array slice with start only', () => {
      const results = Array.from(
        match({ expression: 'users[1:]', value: testData }),
      );
      expect(results).toHaveLength(3);
      const first = results[0];
      const second = results[1];
      const third = results[2];
      expect(first.path).toEqual(['users', 1]);
      expect(second.path).toEqual(['users', 2]);
      expect(third.path).toEqual(['users', 3]);
    });

    test('matches array slice with end only', () => {
      const results = Array.from(
        match({ expression: 'users[:2]', value: testData }),
      );
      expect(results).toHaveLength(2);
      const first = results[0];
      const second = results[1];
      expect(first.path).toEqual(['users', 0]);
      expect(second.path).toEqual(['users', 1]);
    });
  });

  describe('Wildcards', () => {
    test('matches wildcard on object', () => {
      const results = Array.from(
        match({ expression: 'bicycle.*', value: testData }),
      );
      expect(results).toHaveLength(2);
      const first = results[0];
      const second = results[1];
      expect(first.path).toEqual(['bicycle', 'color']);
      expect(second.path).toEqual(['bicycle', 'type']);
      expect(first.value).toEqual('red');
      expect(second.value).toEqual('road');
    });

    test('matches wildcard on array', () => {
      const results = Array.from(
        match({ expression: 'users[*]', value: testData }),
      );
      expect(results).toHaveLength(4);
      const [first, second, third, fourth] = results;
      expect(first.path).toEqual(['users', 0]);
      expect(second.path).toEqual(['users', 1]);
      expect(third.path).toEqual(['users', 2]);
      expect(fourth.path).toEqual(['users', 3]);
    });

    test('matches wildcard with property access', () => {
      const results = Array.from(
        match({ expression: 'users[*].name', value: testData }),
      );
      expect(results).toHaveLength(4);
      const [first, second, third, fourth] = results;
      expect(first.value).toEqual('Alice');
      expect(first.path).toEqual(['users', 0, 'name']);
      expect(second.value).toEqual('Bob');
      expect(second.path).toEqual(['users', 1, 'name']);
      expect(third.value).toEqual('Carol');
      expect(third.path).toEqual(['users', 2, 'name']);
      expect(fourth.value).toEqual('Jules');
      expect(fourth.path).toEqual(['users', 3, 'name']);
    });
  });

  describe('Constraints', () => {
    test('matches comparison constraint', () => {
      const results = Array.from(
        match({ expression: 'users[age > 28]', value: testData }),
      );
      expect(results).toHaveLength(3);
      const [first, second, third] = results;
      expect(first.value).toEqual({
        name: 'Bob',
        age: 30,
        email: 'bob@example.com',
        role: 'admin',
      });
      expect(first.path).toEqual(['users', 1]);
      expect(second.value).toEqual({
        name: 'Carol',
        age: 35,
        email: 'carol@example.com',
        role: 'admin',
      });
      expect(second.path).toEqual(['users', 2]);
      expect(third.value).toEqual({
        name: 'Jules',
        age: 44,
        role: 'user',
      });
      expect(third.path).toEqual(['users', 3]);
    });

    test('matches equality constraint', () => {
      const results = Array.from(
        match({ expression: 'users[name == "Alice"]', value: testData }),
      );
      expect(results).toHaveLength(1);
      const { value, path } = results[0];
      expect(value).toEqual({
        name: 'Alice',
        age: 25,
        email: 'alice@example.com',
        role: 'user',
      });
      expect(path).toEqual(['users', 0]);
    });

    test('matches constraint with property access', () => {
      const results = Array.from(
        match({ expression: 'users[age > 28].name', value: testData }),
      );
      expect(results).toHaveLength(3);
      const [first, second, third] = results;
      expect(first.value).toEqual('Bob');
      expect(first.path).toEqual(['users', 1, 'name']);
      expect(second.value).toEqual('Carol');
      expect(second.path).toEqual(['users', 2, 'name']);
      expect(third.value).toEqual('Jules');
      expect(third.path).toEqual(['users', 3, 'name']);
    });

    test('matches existence constraint', () => {
      const results = Array.from(
        match({ expression: 'users[email?]', value: testData }),
      );
      console.log(results);
      expect(results).toHaveLength(3); // Alice, Bob, and Carol have email (Jules doesn't have email)
      const [first, second, third] = results;
      expect(first.path).toEqual(['users', 0]);
      expect(second.path).toEqual(['users', 1]);
      expect(third.path).toEqual(['users', 2]);
    });

    test('matches multiple constraints (OR logic)', () => {
      const results = Array.from(
        match({
          expression: 'users[age > 32, name == "Alice"].name',
          value: testData,
        }),
      );
      expect(results).toHaveLength(3); // Carol (age > 32), Jules (age > 32), and Alice (name == "Alice")
      const [first, second, third] = results;
      expect(first.value).toEqual('Carol');
      expect(first.path).toEqual(['users', 2, 'name']);
      expect(second.value).toEqual('Jules');
      expect(second.path).toEqual(['users', 3, 'name']);
      expect(third.value).toEqual('Alice');
      expect(third.path).toEqual(['users', 0, 'name']);
    });

    test('matches multiple chained constraints (AND logic)', () => {
      const results = Array.from(
        match({
          expression: 'users[role == "admin"][age > 32].name',
          value: testData,
        }),
      );
      expect(results).toHaveLength(1); // Carol (age > 32) (role == "admin")
      const [first] = results;
      expect(first.value).toEqual('Carol');
      expect(first.path).toEqual(['users', 2, 'name']);
    });
  });

  describe('Keyed Objects', () => {
    test('uses _key for keyed array items', () => {
      const results = Array.from(
        match({ expression: 'items[0]', value: keyedData }),
      );
      expect(results).toHaveLength(1);
      const { value, path } = results[0];
      expect(value).toEqual({
        _key: 'item1',
        name: 'First',
        price: 100,
      });
      expect(path).toEqual(['items', { _key: 'item1' }]);
    });

    test('uses _key for keyed items in wildcard', () => {
      const results = Array.from(
        match({ expression: 'items[*]', value: keyedData }),
      );
      expect(results).toHaveLength(3);
      const [first, second, third] = results;
      expect(first.path).toEqual(['items', { _key: 'item1' }]);
      expect(second.path).toEqual(['items', { _key: 'item2' }]);
      expect(third.path).toEqual(['items', { _key: 'item3' }]);
    });

    test('uses _key for keyed items in constraint', () => {
      const results = Array.from(
        match({ expression: 'items[price > 150]', value: keyedData }),
      );
      expect(results).toHaveLength(2);
      const [first, second] = results;
      expect(first.path).toEqual(['items', { _key: 'item2' }]);
      expect(second.path).toEqual(['items', { _key: 'item3' }]);
    });
  });

  describe('Expression Unions', () => {
    test('matches simple union', () => {
      const results = Array.from(
        match({ expression: '[users, config]', value: testData }),
      );
      expect(results).toHaveLength(2);
      const [first, second] = results;
      expect(first.path).toEqual(['users']);
      expect(first.value).toBe(testData.users);
      expect(second.path).toEqual(['config']);
      expect(second.value).toBe(testData.config);
    });

    test('matches union with property access', () => {
      const results = Array.from(
        match({
          expression: '[bicycle.color, config.version]',
          value: testData,
        }),
      );
      expect(results).toHaveLength(2);
      const [first, second] = results;
      expect(first.value).toEqual('red');
      expect(first.path).toEqual(['bicycle', 'color']);
      expect(second.value).toEqual('1.0.0');
      expect(second.path).toEqual(['config', 'version']);
    });
  });

  describe('Complex Expressions', () => {
    test('matches complex nested expression', () => {
      const complexData = {
        data: {
          items: [
            { tags: ['red', 'blue'], price: 100 },
            { tags: ['green'], price: 200 },
          ],
        },
      };

      const results = Array.from(
        match({ expression: 'data.items[*].tags[0]', value: complexData }),
      );
      expect(results).toHaveLength(2);
      const [first, second] = results;
      expect(first.value).toEqual('red');
      expect(first.path).toEqual(['data', 'items', 0, 'tags', 0]);
      expect(second.value).toEqual('green');
      expect(second.path).toEqual(['data', 'items', 1, 'tags', 0]);
    });

    test('matches path with multiple subscripts', () => {
      const matrixData = {
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      };

      const results = Array.from(
        match({ expression: 'matrix[1][2]', value: matrixData }),
      );
      expect(results).toHaveLength(1);
      const { value, path } = results[0];
      expect(value).toBe(6);
      expect(path).toEqual(['matrix', 1, 2]);
    });
  });

  describe('Edge Cases', () => {
    test('returns empty for non-existent paths', () => {
      const results = Array.from(
        match({ expression: 'nonexistent', value: testData }),
      );
      expect(results).toHaveLength(0);
    });

    test('returns empty for invalid array access', () => {
      const results = Array.from(
        match({ expression: 'users[999]', value: testData }),
      );
      expect(results).toHaveLength(0);
    });

    test('returns empty for constraints on non-arrays', () => {
      const results = Array.from(
        match({ expression: 'config[name == "test"]', value: testData }),
      );
      expect(results).toHaveLength(0);
    });

    test('handles empty data', () => {
      const results = Array.from(match({ expression: 'anything', value: {} }));
      expect(results).toHaveLength(0);
    });

    test('handles null values', () => {
      const nullData = { value: null };
      const results = Array.from(
        match({ expression: 'value', value: nullData }),
      );
      expect(results).toHaveLength(1);
      const { value } = results[0];
      expect(value).toBe(null);
    });
  });

  describe('Generator Behavior', () => {
    test('can get first match only', () => {
      const query = parse('users[*].name');
      const generator = match({ expression: query, value: testData });
      const first = generator.next();

      expect(first.done).toBe(false);
      const { value, path } = first.value;
      expect(value).toBe('Alice');
      expect(path).toEqual(['users', 0, 'name']);
    });

    test('allows early termination', () => {
      const query = parse('users[*].name');
      const generator = match({ expression: query, value: testData });

      // Get first two results
      const results = [];
      for (const result of generator) {
        results.push(result);
        if (results.length === 2) break;
      }

      expect(results).toHaveLength(2);
      const [first, second] = results;
      expect(first.value).toEqual('Alice');
      expect(first.path).toEqual(['users', 0, 'name']);
      expect(second.value).toEqual('Bob');
      expect(second.path).toEqual(['users', 1, 'name']);
    });
  });
});
