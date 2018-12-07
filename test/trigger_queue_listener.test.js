import test from 'ava'

const TriggerQueueListener = require('../lib/trigger_queue_listener.js')
const Queue = require('../lib/queue.js')

test('should invoke trigger for each file event on queue', async t => {
  const q = Queue('queue-id-trigger')
  const trigger = 'my-trigger'

  const files = new Map([
    ['my-file-a.jpg', 'added'],
    ['my-file-b.jpg', 'modified'],
    ['my-file-c.jpg', 'deleted'],
    ['my-file-aa.jpg', 'added'],
    ['my-file-bb.jpg', 'modified'],
    ['my-file-cc.jpg', 'deleted'],
    ['my-file-aaa.jpg', 'added'],
    ['my-file-bbb.jpg', 'modified'],
    ['my-file-ccc.jpg', 'deleted']
  ])

  t.plan((files.size * 2) + 2)

  const invoke = async options => {
    t.is(options.name, trigger)
    const name = options.params.name
    const status = options.params.status
    t.is(files.get(name), status)
    files.delete(name)
    return new Promise((resolve, reject) => {
      setTimeout(resolve, Math.random()*100)
    })
  }

  const client = { triggers: { invoke } }
    
  const listener = TriggerQueueListener(q, trigger, client)
  q.push(files)

  return new Promise((resolve) => {
    setTimeout(() => {
      t.is(files.size, 0)
      t.false(listener.is_running())
      resolve()
    }, 150)
  })
})
