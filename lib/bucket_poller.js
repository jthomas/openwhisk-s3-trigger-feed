const BucketFiles = require('./bucket_files.js')

module.exports = (bucket_files, id, cache, cb) => {
  return async () => {
    console.log('Polling for bucket changes....')

    console.time(id)
    //const current_files = await BucketFiles.etags(client, bucket)
    const current_files = await bucket_files.etags(id)
    console.timeEnd(id)

    console.time('get_bucket_compressed')
    const previous_files = await cache.get(id) || new Map()
    console.timeEnd('get_bucket_compressed')

    const changes = bucket_files.file_changes(previous_files, current_files)
    console.log('file changes:', changes)

    if (changes.size) {
      console.time('set_bucket_compressed')

      for (let [name, status] of changes) { 
        await cb(name, status)
      }

      await cache.set(id, current_files)
      console.timeEnd('set_bucket_compressed')
    }
  }
}
