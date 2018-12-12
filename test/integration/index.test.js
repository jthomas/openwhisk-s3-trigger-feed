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
  await redis.del(config.bucket.id)
}) 

test.after.always(async t => {
  const ow = openwhisk()

  await ow.triggers.delete({name: 's3-trigger-feed-test'})
  await ow.rules.delete({name: 's3-trigger-feed-test-rule'})

  const redis = Redis(config.redis)
  await redis.del(config.bucket.id)
})

test('object store bucket changes should invoke openwhisk triggers', async t => {
  const ow = openwhisk()

  const triggerManager = {
    fireTrigger: (id, event) => ow.triggers.invoke({name: id, params: event})
  }

  const feedProvider = new S3TriggerFeed(triggerManager, logger)

  const trigger = '/_/s3-trigger-feed-test'
  const details = {
    bucket: config.bucket.id,
    s3_endpoint: config.bucket.endpoint,
    s3_api_key: config.bucket.api_key,
    interval: 0
  }

  const s3 = new COS.S3({
    endpoint: config.bucket.endpoint,
    apiKeyId: config.bucket.api_key
  })

  feedProvider.add(trigger, details)

  const NUMBER_OF_FILES = 100
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
    logger.info(`looking for ${max} activations (${name}) since ${since}`)
    let activations = []
    while(activations.length < max) {
      activations = await ow.activations.list({name, since, limit: max})
      logger.info('returned activations', activations.length)
    }

    logger.info('retrieving activation details...')
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
        Bucket: config.bucket.id,
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
