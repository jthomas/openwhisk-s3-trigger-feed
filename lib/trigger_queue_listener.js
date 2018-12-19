module.exports = (queue, operation, logger, id) => {
  let running = false

  queue.on('message', () => {
    if (!running) run()
  })

  const is_running = () => running

  const run = async () => {
    if (running) return

    running = true
    let files 

    while(files = queue.pop()) {
      logger.info(`Queue (${id}) received new message with ${files.length} trigger events.`)

      const requests = files.map(evt => {
        logger.debug(`Queue (${id}) firing async trigger events:`, evt.file.Key, evt.status)
        return operation(evt)
      })

      await Promise.all(requests)
      logger.info(`Queue (${id}) fired ${files.length} trigger events.`)
    }

    running = false
  }

  return { is_running, run }
}
