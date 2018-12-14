import test from 'ava'

const validate = require('../../lib/validate.js')

test.before(t => {
  t.context.params = {
    bucket: 'some-bucket',
    s3_endpoint: 'some.endpoint.com',
    s3_apikey: 'some-key-for-the-bucket',
    interval: 100
  }
})

test('should return error when missing bucket parameter', async t => {
  const params = Object.assign({}, t.context.params)
  delete params.bucket

  await t.throwsAsync(async () => validate(params), {message: 's3 trigger feed: missing bucket parameter'});
})

test('should return error when missing endpoint parameter', async t => {
  const params = Object.assign({}, t.context.params)
  delete params.s3_endpoint

  await t.throwsAsync(async () => validate(params), {message: 's3 trigger feed: missing s3_endpoint parameter'});
})

test('should return error when missing s3_apikey parameter', async t => {
  const params = Object.assign({}, t.context.params)
  delete params.s3_apikey

  await t.throwsAsync(async () => validate(params), {message: 's3 trigger feed: missing s3_apikey parameter'});
})

test('should return error when missing interval parameter', async t => {
  const params = Object.assign({}, t.context.params)
  delete params.interval

  await t.throwsAsync(async () => validate(params), {message: 's3 trigger feed: missing interval parameter'});
})

test('should return error when interval parameter is invalid', async t => {
  const params = Object.assign({}, t.context.params)
  // interval can't be less than one minute
  params.interval = 0.99999

  await t.throwsAsync(async () => validate(params), {message: 's3 trigger feed: invalid interval parameter'});

  // interval needs to be whole number of minutes
  params.interval = 1.5

  await t.throwsAsync(async () => validate(params), {message: 's3 trigger feed: invalid interval parameter'});

  // interval must be a number
  params.interval = 'string'

  await t.throwsAsync(async () => validate(params), {message: 's3 trigger feed: invalid interval parameter'});
})

test('should return error with code or message when accessing bucket fails', async t => {
  const params = Object.assign({}, t.context.params)

  const err = new Error('bucket error')
  err.code = 'SomeBucketError'

  const listObjects = () => ({ promise: () => Promise.reject(err) })
  function client () {
    return { listObjects }
  }

  await t.throwsAsync(async () => validate(params, client), {message: 's3 trigger feed: error returned accessing bucket => (code: SomeBucketError, message: bucket error)'});
})

test('should resolve with valid params when accessing bucket succeeds', async t => {
  const params = Object.assign({}, t.context.params)

  const listObjects = () => ({ promise: () => Promise.resolve() })
  function client () {
    return { listObjects }
  }

  const valid_params = await validate(params, client)
  t.deepEqual(params, valid_params)
})

test('should ignore extra params when validating input', async t => {
  const params = Object.assign({}, t.context.params)

  params.hello = 'world'
  params.foo = 'bar'
  params.abc = 'zoom'

  const listObjects = () => ({ promise: () => Promise.resolve() })
  function client () {
    return { listObjects }
  }

  const valid_params = await validate(params, client)
  t.deepEqual(t.context.params, valid_params)
})
