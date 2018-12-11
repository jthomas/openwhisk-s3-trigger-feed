import test from 'ava'
const crypto = require("crypto")
const BucketFiles = require('../../lib/bucket_files.js')

test('should return no changes for empty current and previous buckets', t => {
  const changed = BucketFiles().file_changes(new Map(), new Map())

  t.is(changed.size, 0, 'bucket should be empty')
})

test('should return no changes for same current and previous bucket files', t => {
  const files = new Map()

  const total_files = 100
  for (let idx = 0; idx < total_files; idx++) {
    const name = crypto.randomBytes(20).toString('hex');
    const etag = crypto.randomBytes(40).toString('hex');
    files.set(name, etag)
  }

  t.is(files.size, 100)
  const changed = BucketFiles().file_changes(files, files)

  t.is(changed.size, 0, 'bucket should be empty')
})

test('should return all files added with empty previous bucket files', t => {
  const previous = new Map()
  const current = new Map()

  const total_files = 100
  for (let idx = 0; idx < total_files; idx++) {
    const name = crypto.randomBytes(20).toString('hex')
    const etag = crypto.randomBytes(40).toString('hex')
    current.set(name, etag)
  }

  t.is(current.size, 100)
  t.is(previous.size, 0)

  const changed = BucketFiles().file_changes(previous, current)
  t.is(changed.size, current.size, 'bucket should have all the new files')

  for (let [name, status] of changed) { 
    t.true(current.has(name), 'file should exist in current bucket')
    t.is(status, 'added', 'file should have added status')
  }
})

test('should return all files deleted with empty current bucket files', t => {
  const previous = new Map()
  const current = new Map()

  const total_files = 100
  for (let idx = 0; idx < total_files; idx++) {
    const name = crypto.randomBytes(20).toString('hex')
    const etag = crypto.randomBytes(40).toString('hex')
    previous.set(name, etag)
  }

  t.is(current.size, 0)
  t.is(previous.size, 100)

  const changed = BucketFiles().file_changes(previous, current)
  t.is(changed.size, previous.size, 'bucket should have all the new files')

  for (let [name, status] of changed) { 
    t.true(previous.has(name), 'file should exist in current bucket')
    t.is(status, 'deleted', 'file should have added status')
  }
})

test('should return all files changed with different etags for same files in both buckets', t => {
  const previous = new Map()
  const current = new Map()

  const total_files = 100
  for (let idx = 0; idx < total_files; idx++) {
    const name = crypto.randomBytes(20).toString('hex')
    const previous_etag = crypto.randomBytes(40).toString('hex')
    const current_etag = crypto.randomBytes(40).toString('hex')
    previous.set(name, previous_etag)
    current.set(name, current_etag)
  }

  t.is(current.size, total_files)
  t.is(previous.size, total_files)

  const changed = BucketFiles().file_changes(previous, current)
  t.is(changed.size, current.size, 'bucket should have all changed files')
  t.is(changed.size, previous.size, 'bucket should have all changed files')

  for (let [name, status] of changed) { 
    t.true(previous.has(name), 'file should exist in previous bucket')
    t.true(current.has(name), 'file should exist in current bucket')
    t.is(status, 'modified', 'file should have modified status')
  }
})

test('should return correct files statuses with multiple file changes in buckets', t => {
  const previous = new Map()
  const current = new Map()

  const added = new Set()
  const modified = new Set()
  const deleted = new Set()
  const unmodified = new Set()

  const total_files = 100
  for (let idx = 0; idx < total_files; idx++) {
    const name = crypto.randomBytes(20).toString('hex')
    const etag = crypto.randomBytes(40).toString('hex')
    previous.set(name, etag)
    current.set(name, etag)

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
        current.set(new_name, new_etag)
        added.add(new_name)
        unmodified.add(name)
        break
      case 1: 
        const modified_etag = crypto.randomBytes(40).toString('hex')
        current.set(name, modified_etag)
        modified.add(name)
        break
      case 2: 
        current.delete(name)
        deleted.add(name)
        break
      default:
        throw new Error('invalid operation state')
        break
    }
  }

  // data validation to ensure setup code is working as expected...
  t.is(previous.size, total_files)
  t.is(current.size, previous.size + added.size - deleted.size)
  t.is(unmodified.size, added.size)
  t.is(unmodified.size, previous.size - deleted.size - modified.size)

  const changed = BucketFiles().file_changes(previous, current)
  t.is(changed.size, added.size + modified.size + deleted.size, 'files changes should have all changed files')

  for (let [name, status] of changed) { 
    switch (status) {
      case 'added':
        t.true(added.has(name))
        added.delete(name)
        break
      case 'deleted':
        t.true(deleted.has(name))
        deleted.delete(name)
        break
      case 'modified':
        t.true(modified.has(name))
        modified.delete(name)
        break
      default:
        throw new Error('invalid status')
    }
  }

  t.is(added.size, 0)
  t.is(deleted.size, 0)
  t.is(modified.size, 0)
})

test('should return empty etag map for empty bucket', async t => {
  t.plan(2)
  const bucket = 'testing'
  const results = { Contents: [] }

  const client = {
    listObjects: options => {
      t.is(options.Bucket, bucket)
      return { promise: () => Promise.resolve(results) }
    }
  }
  const name_etags = await BucketFiles(client).etags(bucket)
  t.is(name_etags.size, 0, 'etags map should be empty')
})

test('should return etag map for bucket with files', async t => {
  t.plan(8)
  const bucket = 'testing'
  const results = { Contents: [ 
    { Key: 'hello', ETag: 'world' },
    { Key: 'foo', ETag: 'bar' },
    { Key: 'testing', ETag: 'value' },
  ] }

  const client = {
    listObjects: options => {
      t.is(options.Bucket, bucket)
      return { promise: () => Promise.resolve(results) }
    }
  }
  const name_etags = await BucketFiles(client).etags(bucket)
  t.is(name_etags.size, results.Contents.length, 'etags map match results')

  results.Contents.forEach(file => {
    t.true(name_etags.has(file.Key))
    t.is(name_etags.get(file.Key), file.ETag)
  })
})
