import test from 'ava'

const crypto = require("crypto")
const BucketPoller = require('../lib/bucket_poller.js')
const BucketFiles = require('../lib/bucket_files.js')

test('should fire async callback for all file changes', async t => {
  const previous_files = new Map()

  const total_files = 100
  for (let idx = 0; idx < total_files; idx++) {
    const name = crypto.randomBytes(20).toString('hex');
    const etag = crypto.randomBytes(40).toString('hex');
    previous_files.set(name, etag)
  }

  const current_files = new Map(previous_files)
  const names = Array.from(previous_files.keys())
  const changes = new Map()

  // replace each second file (add & deleted operation) 
  for (let idx = 0; idx < total_files; idx += 2) {
    current_files.delete(names[idx])
    changes.set(names[idx], 'deleted')
    const name = crypto.randomBytes(20).toString('hex');
    const etag = crypto.randomBytes(40).toString('hex');
    current_files.set(name, etag)
    changes.set(name, 'added')
  }

  // change half of previous files (modified operation) 
  for (let idx = 1; idx < total_files; idx += 4) {
    const etag = crypto.randomBytes(40).toString('hex');
    current_files.set(names[idx], etag)
    changes.set(names[idx], 'modified')
  }

  const BUCKET = 'some-bucket'
  const bucket_files = {
    etags: () => current_files,
    file_changes: BucketFiles.file_changes
  }

  const cache = {
    get: () => previous_files,
    set: () => {}
  }
  const cb = async (name, status) => {
    t.is(changes.get(name), status)
    changes.delete(name)
  }

  t.is(changes.size, 125)

  const bucket_poller = BucketPoller(bucket_files, BUCKET, cache, cb)
  await bucket_poller()

  t.is(changes.size, 0)
})

test('should cache current files with file changes', async t => {
  t.fail()
})

test('should handle callback failures when caching files', async t => {
  t.fail()
})
