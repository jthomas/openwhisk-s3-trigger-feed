import test from 'ava'

const PollManager = require('../lib/poll_manager.js')

test('should set timeout id in poll state and call set with operation and delay', async t => {
  t.plan(3)
  const state = new Map()
  const delay = 1000
  const id = 'bucket-name'
  const operation = async () => {}

  const set = (_operation, _delay) => {
    t.deepEqual(_operation, operation)
    t.is(_delay, delay)
    return 12345
  }

  const manager = PollManager(state, set)

  manager.add(id, operation, delay)
  t.is(state.get(id), 12345)
})

test('should repeat polling operation until id is removed from state', async t => {
  t.plan(12)
  const state = new Map()
  const delay = 1000
  const id = 'bucket-name'
  const operation = async () => {
    t.pass()
  }

  let count = 0
  const max_count = 10

  const finished = new Promise((resolve, reject) => {
    setTimeout(resolve, 100)
  })

  const set = (poll) => {
    if (count > max_count) {
      t.fail()
    }
    count++
    setTimeout(poll, 0)
    return (count > max_count ? null : count)
  }

  const manager = PollManager(state, set)
  manager.add(id, operation, delay)

  await finished
  t.is(count, max_count + 1)
  t.is(state.get(id), null)
})

test('should clear timeout and remove key from state on remove', async t => {
  const id = 'bucket-id'
  const state = new Map()
  t.plan(3)

  const manager = PollManager(state, setTimeout, id => {
    t.pass()
    clearTimeout(id)
  })

  manager.add(id, () => t.fail(), 10)
  t.is(state.size, 1)

  setTimeout(() => {
    manager.remove(id)
  }, 0)

  const finished = new Promise((resolve, reject) => {
    setTimeout(resolve, 100)
  })
  await finished

  t.is(state.size, 0)
})
