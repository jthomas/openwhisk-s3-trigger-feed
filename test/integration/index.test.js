import test from 'ava'

const S3TriggerFeed = require('../../index.js')
const Redis = require('../../lib/redis.js')
const openwhisk = require('openwhisk')
const COS = require('ibm-cos-sdk')

const mandatoryEnvParams = [
  'REDIS',
  'BUCKET_ID',
  'BUCKET_ENDPOINT',
  'BUCKET_API_KEY',
  '__OW_API_HOST',
  '__OW_API_KEY',
  '__OW_NAMESPACE',
]

for (let param of mandatoryEnvParams) {
  if (!process.env[param]) throw new Error(`Missing mandatory environment parameter ${param}`)
}

test.before(async t => {
  const ow = openwhisk()

  console.log('create triggers & rules...')
  await ow.triggers.update({name: 's3-trigger-feed-test'})
  await ow.rules.update({name: 's3-trigger-feed-test-rule', action: '/whisk.system/utils/echo', trigger: 's3-trigger-feed-test'})

  console.log('ensuring bucket is empty...')
  const s3 = new COS.S3({
    endpoint: process.env.BUCKET_ENDPOINT,
    apiKeyId: process.env.BUCKET_API_KEY
  })

  const bucket = await s3.listObjects({ Bucket: process.env.BUCKET_ID }).promise()
  const params = {
    Bucket: process.env.BUCKET_ID,
    Delete: { }
  }

  params.Delete.Objects = bucket.Contents.map(file => ({Key: file.Key}))
  if (params.Delete.Objects.length) {
    console.log('removing bucket files:', params.Delete.Objects.length)
    await s3.deleteObjects(params).promise()
  }

  console.log('clearing cached file list')
  const redis = Redis(process.env.REDIS)
  await redis.del(process.env.BUCKET_ID)
}) 

test.after.always(async t => {
  const ow = openwhisk()

  await ow.triggers.delete({name: 's3-trigger-feed-test'})
  await ow.rules.delete({name: 's3-trigger-feed-test-rule'})

  const redis = Redis(process.env.REDIS)
  await redis.del(process.env.BUCKET_ID)
})

test('object store bucket changes should invoke openwhisk triggers', async t => {
  const ow = openwhisk()

  const triggerManager = {
    fireTrigger: (id, event) => ow.triggers.invoke({name: id, params: event})
  }

  const feedProvider = S3TriggerFeed(triggerManager, console)

  const trigger = '/_/s3-trigger-feed-test'
  const details = {
    bucket: process.env.BUCKET_ID,
    s3_endpoint: process.env.BUCKET_ENDPOINT,
    s3_api_key: process.env.BUCKET_API_KEY,
    interval: 0
  }

  const s3 = new COS.S3({
    endpoint: process.env.BUCKET_ENDPOINT,
    apiKeyId: process.env.BUCKET_API_KEY
  })

  feedProvider.add(trigger, details)

  const NUMBER_OF_FILES = 100
  const newFiles = []

  for(let i = 0; i < NUMBER_OF_FILES; i++) {
    newFiles.push({
      Bucket: process.env.BUCKET_ID,
      Key: `file-${i}.txt`,
      Body: `original-file-contents-${i}`,
    })
  }

  const putFilesinBucket = async files => await Promise.all(
    files.map(file => s3.putObject(file).promise())
  )

  const sort_name = (a, b) => {
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }

    return 0;
  }

  const wait_for_activations = async (name, since, max) => {
    console.log(`looking for ${max} activations (${name}) since ${since}`)
    let activations = []
    while(activations.length < max) {
      activations = await ow.activations.list({name, since, limit: max})
      console.log('returned activations', activations.length)
    }

    console.log('retrieving activation details...')
    const activationObjs = await Promise.all(activations.map(actv => ow.activations.get({name: actv.activationId})))
    const activationEvents = activationObjs.map(actv => actv.response.result)
      .sort(sort_name)

    return activationEvents
  }

  const fileEvents = (files, status) =>
    files.map(file => ({ name: file.Key, status }))
    .sort(sort_name)

  return new Promise(async (resolve, reject) => {
    try {
      let now = Date.now()
      await putFilesinBucket(newFiles)

      let activationEvents = await wait_for_activations('s3-trigger-feed-test', now, newFiles.length)
      t.deepEqual(fileEvents(newFiles, 'added'), activationEvents)

      newFiles.forEach((file, i) => file.Body = `modified-file-contents-${i}`)

      now = Date.now()
      await putFilesinBucket(newFiles)

      activationEvents = await wait_for_activations('s3-trigger-feed-test', now, newFiles.length)
      t.deepEqual(fileEvents(newFiles, 'modified'), activationEvents)

      const params = {
        Bucket: process.env.BUCKET_ID,
        Delete: {}
      }

      now = Date.now()
      params.Delete.Objects = newFiles.map(file => ({Key: file.Key}))
      await s3.deleteObjects(params).promise()

      activationEvents = await wait_for_activations('s3-trigger-feed-test', now, newFiles.length)
      t.deepEqual(fileEvents(newFiles, 'deleted'), activationEvents)

      resolve()
    } catch (err) {
      reject(err)
    }
  })
});
