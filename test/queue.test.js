import test from 'ava'

const queue = require('../lib/queue.js')

test('should allow users to push and pop FIFO queue', t => {
  const q = queue('queue-id-a')

  const items = [
    "string",
    12345,
    { hello: 'world' },
    true
  ]
    
  items.forEach(item => q.push(item))
  items.forEach(item => t.is(item, q.pop(), 'items added in order of insertion'))
  t.is(undefined, q.pop(), 'queue is empty')
})

test('should emit message on push()', async t => {
  const q = queue('queue-id-b')

  const items = [
    "string",
    12345,
    { hello: 'world' },
    true
  ]

  t.plan(items.length)
  q.on('message', () => {
    t.pass()
  })
 
  items.forEach(item => q.push(item))

  return new Promise((resolve, reject) => {
    setImmediate(resolve)
  })
})

test('should emit empty event when queue has no more items', async t => {
  const q = queue('queue-id-c')

  const items = [
    "string",
    12345,
    { hello: 'world' },
    true
  ]

  t.plan(1)
  q.on('empty', () => {
    t.pass()
  })

  items.forEach(item => q.push(item))
  items.forEach(item => q.pop())

  return new Promise((resolve, reject) => {
    setImmediate(resolve)
  })
})
