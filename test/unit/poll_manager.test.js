import test from 'ava'

const PollManager = require('../../lib/poll_manager.js')

test('should set timeout ids and call poll operation with correct delays', async t => {
  t.plan(4)

  const state = new Map()
  const delay = 1000
  const id = 'bucket-name'
  const operation = async () => Promise.resolve()

  let current_delay
  let current_operation 

  const set = (_operation, _delay) => {
    current_delay = _delay
    current_operation = _operation
    return 12345
  }

  const manager = PollManager(state, set)

  // first poll operation after addition should be immediate
  manager.add(id, operation, delay)
  t.is(state.get(id), 12345)
  t.is(current_delay, 0)
  // ..then uses delay parameter
  await current_operation()
  t.is(state.get(id), 12345)
  t.is(current_delay, delay)
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

test('should clear timeout and remove key from state on remove', t => {
  const id = 'bucket-id'
  const state = new Map()
  const timeout_id = 12345
  t.plan(4)

  const manager = PollManager(state, () => timeout_id, id => {
    t.is(id, timeout_id)
  })

  manager.add(id, () => t.fail(), 100)
  t.is(state.size, 1)
  t.is(state.get(id), timeout_id)

  manager.remove(id)
  t.is(state.size, 0)
})

test('should clear timeout and emit error when operation fails', async t => {
  const id = 'trigger-id'
  const state = new Map()
  const timeout_id = 12345
  const err = new Error('some error message')
  t.plan(3)

  const manager = PollManager(state, setTimeout, clearTimeout)

  manager.on('error', (_id, _err) => {
    t.is(id, _id)
    t.is(err, _err)
    t.is(state.size, 0)
  })

  manager.add(id, () => {throw err}, 0)
  return new Promise(resolve => setTimeout(resolve, 1))
})
