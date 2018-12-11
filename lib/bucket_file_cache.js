const LRU = require('lru-cache')

const Redis = require('./redis.js') 
const Cache = require('./cache.js') 
const CompressAndSerializeMaps = require('./serialize_map.js')
const SerializedCache = require('./serialized_cache.js')

module.exports = (redis, max_buckets = 1000) => {
  const remote_cache = Redis(redis)
  const local_cache = new LRU(max_buckets)

  const memorizedCache = Cache(local_cache, remote_cache)
  const BucketFileCache = SerializedCache(memorizedCache, CompressAndSerializeMaps)

  return BucketFileCache
}
