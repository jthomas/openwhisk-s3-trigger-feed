const BucketFiles = require('./bucket_files.js')

module.exports = (client, bucket, cache, ow) => {
  return async () => {
    console.log('Polling for bucket changes....')

    console.time(bucket)
    const current_files = await BucketFiles.etags(client, bucket)
    console.timeEnd(bucket)

    console.time('get_bucket_compressed')
    const previous_files = await cache.get(bucket) || new Map()
    console.timeEnd('get_bucket_compressed')

    const changes = BucketFiles.file_changes(previous_files, current_files)
    console.log('file changes:', changes)

    if (changes.size) {
      console.time('set_bucket_compressed')
      await cache.set(bucket, current_files)
      console.timeEnd('set_bucket_compressed')
    }
  }
}
