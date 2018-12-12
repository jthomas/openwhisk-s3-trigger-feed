import test from 'ava'

const cache = require('../../lib/cache.js')
const LRU = require("lru-cache")

test.beforeEach(t => {
  const lru_cache = new LRU(1000)
  const client = { 
    cache: {},
    get: async key => client.cache[key],
    set: async (key, value) => client.cache[key] = value,
    del: async (key) => delete client.cache[key]
  } 
  t.context = { client, lru_cache }
})

test('should return values from local cache when available', async t => {
  const key = 'some_key'
  const value = Buffer.from('some value string')

  t.context.lru_cache.set(key, value)
  const instance = cache(t.context.lru_cache, null)
  const result = await instance.get(key)
  t.is(result, value)
})

test('should return values from remote cache when local cache missing', async t => {
  const key = 'some_key'
  const value = Buffer.from('some value string')

  t.context.client.cache[key] = value
  const instance = cache(t.context.lru_cache, t.context.client)
  const result = await instance.get(key)
  t.is(result, value)
})

test('should update local cache values on remote retrieval', async t => {
  const key = 'some_key'
  const value = Buffer.from('some value string')

  t.context.client.cache[key] = value
  const instance = cache(t.context.lru_cache, t.context.client)
  await instance.get(key)
  t.is(t.context.lru_cache.get(key), value)
})

test('should set values in local and remote caches', async t => {
  const key = 'some_key'
  const value = Buffer.from('some value string')

  const instance = cache(t.context.lru_cache, t.context.client)
  await instance.set(key, value)
  t.is(t.context.lru_cache.get(key), value)
  t.is(t.context.client.cache[key], value)
})

test('should delete values in local and remote caches', async t => {
  const key = 'some_key'
  const value = Buffer.from('some value string')

  t.context.lru_cache.set(key, value)
  t.context.client.cache[key] = value
 
  const instance = cache(t.context.lru_cache, t.context.client)
  await instance.del(key)
  t.false(t.context.lru_cache.has(key))
  t.false(Object.keys(t.context.client.cache).includes(key))
})
