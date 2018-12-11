import test from 'ava'

const crypto = require("crypto")
const BucketPoller = require('../../lib/bucket_poller.js')
const BucketFiles = require('../../lib/bucket_files.js')

test('should queue all returned file changes', async t => {
  t.plan(1)
  const previous_files = new Map()
  const current_files = new Map()

  const total_files = 100

  for (let idx = 0; idx < total_files; idx++) {
    const name = crypto.randomBytes(20).toString('hex');
    const etag = crypto.randomBytes(40).toString('hex');
    current_files.set(name, etag)
  }

  const BUCKET = 'some-bucket'
  const bucket_files = {
    etags: () => current_files,
    file_changes: BucketFiles().file_changes
  }

  const cache = {
    get: () => previous_files,
    set: () => {}
  }

  const push = async item => {
    t.deepEqual(item, BucketFiles().file_changes(previous_files, current_files))
  }

  const bucket_poller = BucketPoller(bucket_files, BUCKET, cache, { push })
  await bucket_poller()
})

test('should not queue anything with no file changes', async t => {
  const current_files = new Map()

  const total_files = 100

  for (let idx = 0; idx < total_files; idx++) {
    const name = crypto.randomBytes(20).toString('hex');
    const etag = crypto.randomBytes(40).toString('hex');
    current_files.set(name, etag)
  }

  const previous_files = new Map(current_files)

  const BUCKET = 'some-bucket'
  const bucket_files = {
    etags: () => current_files,
    file_changes: BucketFiles().file_changes
  }

  let called = false

  const cache = {
    get: () => previous_files,
    set: () => called = true
  }

  const bucket_poller = BucketPoller(bucket_files, BUCKET, cache, { push: () => called = true })
  await bucket_poller()

  t.false(called)
})
