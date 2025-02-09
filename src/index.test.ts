import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as _ from './index.js'

describe('Test serdes', () => {
  it('should reconstruct basic object', () => {
    const source = {
      foo: '123',
      bar: 123,
      qux: null,
      _: ['_', '_'],
      arr: [new Set(['123', {}]), 1, null, new Map([['a', 'b']])]
    }
    const result = _.deserializer(_.serializer(source).data)
    assert.deepEqual(result, source)
  })
})
