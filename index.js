const Redis = require('./lib/redis.js') 
const Cache = require('./lib/cache.js') 
const BucketFiles = require('./lib/bucket_files.js')
const BuckerPoller = require('./lib/bucket_poller.js')
const CompressAndSerializeMaps = require('./lib/serialize_map.js')
const SerializedCache = require('./lib/serialized_cache.js')
const PollManager = require('./lib/poll_manager.js')

const fs = require('fs')
const CONFIG = JSON.parse(fs.readFileSync('config.json', 'utf-8'))

const COS = require('ibm-cos-sdk')
const LRU = require('lru-cache')

// use for self-signed redis certificate
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const client = new COS.S3(CONFIG.object_store)

const MAX_LOCAL_BUCKETS= 1000
const INTERVAL = 1000

const BUCKET = 'polling-for-changes'

const remote_cache = Redis(CONFIG.redis)
const local_cache = new LRU(MAX_LOCAL_BUCKETS)

const memorizedCache = Cache(local_cache, remote_cache)
const cache = SerializedCache(memorizedCache, CompressAndSerializeMaps)

const bucket_poller = BuckerPoller(client, BUCKET, cache)

const state = new Map()
const manager = PollManager(state, setTimeout, clearTimeout)

manager.add(BUCKET, bucket_poller, INTERVAL)
