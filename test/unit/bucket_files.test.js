import test from 'ava'
const crypto = require("crypto")
const BucketFiles = require('../../lib/bucket_files.js')

const bucket = 'some-bucket'
const test_endpoint = 'https://s3.eu-gb.cloud-object-storage.appdomain.cloud'
const logger = { debug: () => {}, info: () => {} }
const client = {
  config: {
    endpoint: test_endpoint
  },
  listObjects: options => {
    t.is(options.Bucket, bucket)
    return { promise: () => Promise.resolve(results) }
  }
}

test('should return no changes for empty current and previous buckets', t => {
  const changed = BucketFiles(client, bucket, logger).file_changes([], [])

  t.is(changed.length, 0, 'bucket should be empty')
})

test('should return no changes for same current and previous bucket files', t => {
  const files = []

  const total_files = 100
  for (let idx = 0; idx < total_files; idx++) {
    const Key = crypto.randomBytes(20).toString('hex');
    const ETag = crypto.randomBytes(40).toString('hex');
    files.push({Key, ETag})
  }

  t.is(files.length, total_files)
  const changed = BucketFiles(client, bucket, logger).file_changes(files, files)

  t.is(changed.length, 0, 'bucket should be empty')
})

test('should return all files added with empty previous bucket files', t => {
  const previous = []
  const current = []

  const total_files = 100
  const files = new Set()
  for (let idx = 0; idx < total_files; idx++) {
    const Key = crypto.randomBytes(20).toString('hex')
    const ETag = crypto.randomBytes(40).toString('hex')
    const file = { Key, ETag }
    current.push(file)
    files.add(file)
  }

  t.is(current.length, 100)
  t.is(previous.length, 0)

  const test_bucket = bucket
  const changed = BucketFiles(client, test_bucket, logger).file_changes(previous, current)
  t.is(changed.length, current.length, 'bucket should have all the new files')

  for (let {file, status, bucket, endpoint, key} of changed) {
    t.true(files.has(file), 'file should exist in current bucket')
    t.is(status, 'added', 'file should have added status')
    t.is(bucket, test_bucket, 'file bucket name should exist in the changed info')
    t.truthy(key, "changed info should include the convenience key")
    t.truthy(endpoint, "changed info should include the endpoint")
  }
})

test('should return all files deleted with empty current bucket files', t => {
  const previous = []
  const current = []

  const total_files = 100
  const files = new Set()
  for (let idx = 0; idx < total_files; idx++) {
    const Key = crypto.randomBytes(20).toString('hex')
    const ETag = crypto.randomBytes(40).toString('hex')
    const file = { Key, ETag }
    previous.push(file)
    files.add(file)
  }

  t.is(previous.length, 100)
  t.is(current.length, 0)

  const test_bucket = bucket
  const changed = BucketFiles(client, test_bucket, logger).file_changes(previous, current)
  t.is(changed.length, previous.length, 'bucket should have all the removed files')

  for (let {file, status, bucket, key, endpoint} of changed) {
    t.true(files.has(file), 'file should exist in previous bucket')
    t.is(status, 'deleted', 'file should have deleted status')
    t.is(bucket, test_bucket, 'file bucket name should exist in the changed info')
    t.truthy(key, "changed info should include the convenience key")
    t.truthy(endpoint, "changed info should include the endpoint")
  }
})

test('should return all files changed with different etags for same files in both buckets', t => {
  const previous = []
  const current = []
  const files = new Set()

  const total_files = 100
  for (let idx = 0; idx < total_files; idx++) {
    const Key = crypto.randomBytes(20).toString('hex')
    const previous_etag = crypto.randomBytes(40).toString('hex')
    const current_etag = crypto.randomBytes(40).toString('hex')
    previous.push({ Key, ETag: previous_etag })
    current.push({ Key, ETag: current_etag })
    files.add(Key)
  }

  t.is(current.length, total_files)
  t.is(previous.length, total_files)

  const test_bucket = bucket
  const changed = BucketFiles(client, test_bucket, logger).file_changes(previous, current)
  t.is(changed.length, current.length, 'bucket should have all changed files')
  t.is(changed.length, previous.length, 'bucket should have all changed files')

  for (let {file, status, bucket, key, endpoint} of changed) {
    t.true(files.has(file.Key), 'file should exist in buckets')
    t.is(status, 'modified', 'file should have modified status')
    t.is(bucket, test_bucket, 'file bucket name should exist in the changed info')
    t.truthy(key, "changed info should include the convenience key")
    t.truthy(endpoint, "changed info should include the endpoint")
  }
})

test('should return correct files statuses with multiple file changes in buckets', t => {
  const previous = []
  const current = []

  const added = new Set()
  const modified = new Set()
  const deleted = new Set()
  const unmodified = new Set()

  const total_files = 100
  for (let idx = 0; idx < total_files; idx++) {
    const Key = crypto.randomBytes(20).toString('hex')
    const ETag = crypto.randomBytes(40).toString('hex')
    previous.push({ Key, ETag })
    current.push({ Key, ETag })

    // make some random modifications to the file list
    // rand produces three states:
    // 0 -> add new file
    // 1 -> change current file etag
    // 2 -> delete current file
    const operation = Math.round(Math.random() * 2)

    switch (operation) {
      case 0: 
        const new_name = crypto.randomBytes(20).toString('hex')
        const new_etag = crypto.randomBytes(40).toString('hex')
        current.push( {Key: new_name, ETag: new_etag })
        added.add(new_name)
        unmodified.add(Key)
        break
      case 1: 
        const modified_etag = crypto.randomBytes(40).toString('hex')
        current[current.length - 1].ETag = modified_etag
        modified.add(Key)
        break
      case 2: 
        current.pop()
        deleted.add(Key)
        break
      default:
        throw new Error('invalid operation state')
        break
    }
  }

  // data validation to ensure setup code is working as expected...
  t.is(previous.length, total_files)
  t.is(current.length, previous.length + added.size - deleted.size)
  t.is(unmodified.size, added.size)
  t.is(unmodified.size, previous.length - deleted.size - modified.size)

  const changed = BucketFiles(client, bucket, logger).file_changes(previous, current)
  t.is(changed.length, added.size + modified.size + deleted.size, 'files changes should have all changed files')

  for (let {file, status} of changed) { 
    switch (status) {
      case 'added':
        t.true(added.has(file.Key))
        added.delete(file.Key)
        break
      case 'deleted':
        t.true(deleted.has(file.Key))
        deleted.delete(file.Key)
        break
      case 'modified':
        t.true(modified.has(file.Key))
        modified.delete(file.Key)
        break
      default:
        throw new Error('invalid status')
    }
  }

  t.is(added.size, 0)
  t.is(deleted.size, 0)
  t.is(modified.size, 0)
})

test('should return empty array for empty bucket', async t => {
  t.plan(2)
  const bucket = 'testing'
  const results = { Contents: [] }

  const client = {
    config: {
      endpoint: test_endpoint
    },
    listObjects: options => {
      t.is(options.Bucket, bucket)
      return { promise: () => Promise.resolve(results) }
    }
  }
  const files = await BucketFiles(client, bucket, logger).current()
  t.is(files.length, 0, 'file array should be empty')
})

test('should return current bucket files', async t => {
  t.plan(2)
  const bucket = 'testing'
  const results = { Contents: [ 
    { Key: 'hello', ETag: 'world' },
    { Key: 'foo', ETag: 'bar' },
    { Key: 'testing', ETag: 'value' },
  ] }

  const client = {
    config: {
      endpoint: test_endpoint
    },
    listObjects: options => {
      t.is(options.Bucket, bucket)
      return { promise: () => Promise.resolve(results) }
    }
  }
  const files = await BucketFiles(client, bucket, logger).current()
  t.deepEqual(files, results.Contents, 'current files must match results')
})
