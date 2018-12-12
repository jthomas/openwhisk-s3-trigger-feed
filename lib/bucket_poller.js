module.exports = (bucket_files, id, cache, queue, logger) => {
  return async () => {
    logger.info(`polling bucket files for trigger: ${id}`)

    const current_files = await bucket_files.etags()
    const previous_files = await cache.get(id) || new Map()

    const changes = bucket_files.file_changes(previous_files, current_files)
    logger.info(`bucket files for trigger (${id}), previous = ${previous_files.size}, current = ${current_files.size}, changed = ${changes.size}`)

    if (changes.size) {
      logger.debug('changed bucket files for trigger (${id}):', JSON.stringify(changes))
      await queue.push(changes)
      await cache.set(id, current_files)
    }
  }
}
