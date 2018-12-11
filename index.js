const COS = require('ibm-cos-sdk')

const BucketFiles = require('./lib/bucket_files.js')
const BucketFileCache = require('./lib/bucket_file_cache.js')
const BucketPoller = require('./lib/bucket_poller.js')
const TimeoutPollingManager = require('./lib/timeout_polling_manager.js')
const Queue = require('./lib/queue.js')
const TriggerQueueListener = require('./lib/trigger_queue_listener.js')

// use for self-signed redis certificate
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

module.exports = (triggerManager, logger, redis = process.env.REDIS) => {
  // Is Redis missing?
  const bucketFileCache = BucketFileCache(redis)
  const scheduler = TimeoutPollingManager()
  const triggers = new Set()

  // what are the details?
  const add = (id, details) => {
    const { bucket, interval, s3_endpoint, s3_api_key } = details

    // ? config validation
    const client = new COS.S3({ endpoint: s3_endpoint, apiKeyId: s3_api_key })

    const bucketFiles = BucketFiles(client)

    // SHOULD BE PER TRIGGER NOT IN A MAP ??
    // WHAT ABOUT CONCURRENT REQUESTS? SHOULD HANDLE MULTIPLE REQS NEED BUCKET + TRIGGER ID?
    const bucketEventQueue = Queue(id)
    const fireTrigger = event => triggerManager.fireTrigger(id, event)

    // fires triggers upon file event messages on queue
    const listener = TriggerQueueListener(bucketEventQueue, fireTrigger)

    // poll bucket files for changes
    const bucketPoller = BucketPoller(bucketFiles, bucket, bucketFileCache, bucketEventQueue)

    const interval_in_ms = interval * 60 * 1000

    // schedule bucket polling each minute
    scheduler.add(id, bucketPoller, interval_in_ms)

    triggers.add(id)
  }
  
  const remove = id => {
    // what id doesn't exist ??

    // stop polling for bucket changes
    scheduler.remove(id)
    // clear out remaining untriggered file change events
    Queue(id).clear()

    triggers.delete(id)
  }

  return { add, remove }
}
