module.exports = (bucket_files, id, cache, queue) => {
  return async () => {
    //console.log('Polling for bucket changes....')

    console.time(id)
    const current_files = await bucket_files.etags(id)
    //    console.timeEnd(id)

    console.time('get_bucket_compressed')
    const previous_files = await cache.get(id) || new Map()
    //console.timeEnd('get_bucket_compressed')

    const changes = bucket_files.file_changes(previous_files, current_files)

    if (changes.size) {
      console.log('file changes:', changes)
      await queue.push(changes)

      console.time('set_bucket_compressed')
      await cache.set(id, current_files)
      // console.timeEnd('set_bucket_compressed')
    }
  }
}
