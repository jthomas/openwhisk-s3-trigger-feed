module.exports = (bucket_files, id, cache, queue, logger) => {
  return async () => {
    logger.info(`polling bucket files for trigger: ${id}`)

    const current_files = await bucket_files.current()
    const previous_files = await cache.get(id) || []

    const changes = bucket_files.file_changes(previous_files, current_files)
    logger.info(`bucket files for trigger (${id}), previous = ${previous_files.length}, current = ${current_files.length}, changed = ${changes.length}`)

    if (changes.length) {
      logger.debug('changed bucket files for trigger (${id}):', JSON.stringify(changes))
      await queue.push(changes)
      await cache.set(id, current_files)
    }
  }
}
