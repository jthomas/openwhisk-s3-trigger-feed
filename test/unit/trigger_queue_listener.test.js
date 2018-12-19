import test from 'ava'

const TriggerQueueListener = require('../../lib/trigger_queue_listener.js')
const Queue = require('../../lib/queue.js')

test('should invoke trigger for each file event on queue', async t => {
  const q = Queue('queue-id-trigger')

  let files = [
    { file: { Key: 'my-file-a.jpg' }, status: 'added' },
    { file: { Key: 'my-file-b.jpg' }, status: 'modified' },
    { file: { Key: 'my-file-c.jpg' }, status: 'deleted' },
    { file: { Key: 'my-file-aa.jpg' }, status: 'added' },
    { file: { Key: 'my-file-bb.jpg' }, status: 'modified' },
    { file: { Key: 'my-file-cc.jpg' }, status: 'deleted' },
    { file: { Key: 'my-file-aaa.jpg' }, status: 'added' },
    { file: { Key: 'my-file-bbb.jpg' }, status: 'modified' },
    { file: { Key: 'my-file-ccc.jpg' }, status: 'deleted' },
  ]

  t.plan((files.length * 2) + 2)

  const operation = async options => {
    const name = options.file.Key
    const status = options.status
    t.is(files[0].status, status)
    t.is(files[0].file.Key, name)
    files = files.slice(1)
    return new Promise((resolve, reject) => {
      setTimeout(resolve, Math.random()*100)
    })
  }

  const logger = { debug: () => {}, info: () => {} }
  const listener = TriggerQueueListener(q, operation, logger)
  q.push(files)

  return new Promise((resolve) => {
    setTimeout(() => {
      t.is(files.length, 0)
      t.false(listener.is_running())
      resolve()
    }, 150)
  })
})
