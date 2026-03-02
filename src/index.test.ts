import * as assert from 'node:assert/strict'
import { describe, it, afterEach } from 'node:test'
import * as _ from './index.js'

describe('Test serdes', () => {
  try {
    afterEach(() => {
      if (global.gc) {
        global.gc()
      }
    })
  } catch {}

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

  it('should not leak memory', async () => {
    // const values = []
    const serialized = _.serializer((callbackFactory: () => Promise<(x: () => string) => Promise<void>>) => {
      callbackFactory().then(callback => callback(() => 'foo'))
      return callbackFactory().then(callback => callback(() => 'bar'))
    })
    const fn = _.deserializer(serialized.data) as (callback: () => (valueProvider: () => Promise<string>) => void) => void

    const results = [] as [string, string][]

    await Promise.all([
      fn(() => (valueProvider) => valueProvider().then(value => results.push(['cb1', value]))),
      fn(() => (valueProvider) => valueProvider().then(value => results.push(['cb2', value])))
    ])

    assert.ok(results.length === 4)
    assert.ok(results.some(([cb, str]) => cb === 'cb1' && str === 'foo'))
    assert.ok(results.some(([cb, str]) => cb === 'cb1' && str === 'bar'))
    assert.ok(results.some(([cb, str]) => cb === 'cb2' && str === 'foo'))
    assert.ok(results.some(([cb, str]) => cb === 'cb2' && str === 'bar'))
  })
})
