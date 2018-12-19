import test from 'ava'

const S3TriggerFeed = require('../../index.js')
const Redis = require('../../lib/redis.js')
const openwhisk = require('openwhisk')
const COS = require('ibm-cos-sdk')
const fs = require('fs')

const winston = require('winston')

const level = process.env.LOG_LEVEL || 'error'
const consoleLogger = new winston.transports.Console({ format: winston.format.simple() })

const logger = winston.createLogger({
  level, transports: [ consoleLogger ]
});

const config = JSON.parse(fs.readFileSync('./test/integration/config.json', 'utf-8'))

const topLevelConfig = ['redis', 'bucket', 'openwhisk']

for (let param of topLevelConfig) {
  if (!config[param]) throw new Error(`Missing mandatory configuration parameter: ${param}`)
}

test.before(async t => {
  const ow = openwhisk(config.openwhisk)

  logger.info('create triggers & rules...')
  await ow.triggers.update({name: 's3-trigger-feed-test'})
  await ow.rules.update({name: 's3-trigger-feed-test-rule', action: '/whisk.system/utils/echo', trigger: 's3-trigger-feed-test'})

  logger.info('ensuring bucket is empty...')
  const s3 = new COS.S3({
    endpoint: config.bucket.endpoint,
    apiKeyId: config.bucket.api_key
  })

  const bucket = await s3.listObjects({ Bucket: config.bucket.id }).promise()
  const params = {
    Bucket: config.bucket.id,
    Delete: { }
  }

  params.Delete.Objects = bucket.Contents.map(file => ({Key: file.Key}))
  if (params.Delete.Objects.length) {
    logger.info('removing bucket files:', params.Delete.Objects.length)
    await s3.deleteObjects(params).promise()
  }

  logger.info('clearing cached file list')
  const redis = Redis(config.redis)
  await redis.del('/_/s3-trigger-feed-test')
}) 

test.after.always(async t => {
  const ow = openwhisk(config.openwhisk)

  await ow.triggers.delete({name: 's3-trigger-feed-test'})
  await ow.rules.delete({name: 's3-trigger-feed-test-rule'})

  const redis = Redis(config.redis)
  await redis.del('/_/s3-trigger-feed-test')
})

test('object store bucket changes should invoke openwhisk triggers', async t => {
  const ow = openwhisk(config.openwhisk)

  const triggerManager = {
    fireTrigger: (id, event) => ow.triggers.invoke({name: id, params: event})
  }

  const feedProvider = new S3TriggerFeed(triggerManager, logger, config.redis)

  const trigger = '/_/s3-trigger-feed-test'
  const details = {
    bucket: config.bucket.id,
    s3_endpoint: config.bucket.endpoint,
    s3_apikey: config.bucket.api_key,
    interval: 0.1
  }

  const s3 = new COS.S3({
    endpoint: config.bucket.endpoint,
    apiKeyId: config.bucket.api_key
  })

  feedProvider.add(trigger, details)

  const NUMBER_OF_FILES = 10
  const newFiles = []

  for(let i = 0; i < NUMBER_OF_FILES; i++) {
    newFiles.push({
      Bucket: config.bucket.id,
      Key: `file-${i}.txt`,
      Body: `original-file-contents-${i}`,
    })
  }

  const putFilesinBucket = async files => await Promise.all(
    files.map(file => s3.putObject(file).promise())
  )

  const timeout = async delay => {
    return new Promise(resolve => setTimeout(resolve, delay))
  }

  const wait_for_activations = async (name, since, max) => {
    logger.info(`looking for ${max} activations (${name}) since ${since}`)
    let activations = []
    while(activations.length < max) {
      activations = await ow.activations.list({name, since, limit: max})
      logger.info(`activations returned: ${activations.length}`)
      await timeout(1000)
    }

    logger.info('retrieving activation details...')
    const activationObjs = await Promise.all(activations.map(actv => ow.activations.get({name: actv.activationId})))
    const activationEvents = activationObjs.map(actv => actv.response.result)

    return activationEvents
  }

  const sort_on = (items, prop) => items.map(prop).sort()

  return new Promise(async (resolve, reject) => {
    try {
      let now = Date.now()
      await putFilesinBucket(newFiles)

      let activationEvents = await wait_for_activations('s3-trigger-feed-test', now, newFiles.length)
      t.deepEqual(sort_on(newFiles, f => f.Key), sort_on(activationEvents, f => f.file.Key))
      t.deepEqual(newFiles.map(() => 'added'), activationEvents.map(f => f.status))


      newFiles.forEach((file, i) => file.Body = `modified-file-contents-${i}`)

      now = Date.now()
      await putFilesinBucket(newFiles)

      activationEvents = await wait_for_activations('s3-trigger-feed-test', now, newFiles.length)
      t.deepEqual(sort_on(newFiles, f => f.Key), sort_on(activationEvents, f => f.file.Key))
      t.deepEqual(newFiles.map(() => 'modified'), activationEvents.map(f => f.status))

      const params = {
        Bucket: config.bucket.id,
        Delete: {}
      }

      now = Date.now()
      params.Delete.Objects = newFiles.map(file => ({Key: file.Key}))
      await s3.deleteObjects(params).promise()

      activationEvents = await wait_for_activations('s3-trigger-feed-test', now, newFiles.length)
      t.deepEqual(sort_on(newFiles, f => f.Key), sort_on(activationEvents, f => f.file.Key))
      t.deepEqual(newFiles.map(() => 'deleted'), activationEvents.map(f => f.status))

      resolve()
    } catch (err) {
      reject(err)
    }
  })
});
