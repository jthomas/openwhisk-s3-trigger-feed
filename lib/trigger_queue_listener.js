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
      logger.info(`Queue (${id}) received new message with ${files.size} trigger events.`)
      const requests = []
      for (let [name, status] of files) { 
        logger.debug(`Queue (${id}) firing async trigger events:`, name, status)
        requests.push(operation({name, status}))
      }
      const results = await Promise.all(requests)
      logger.info(`Queue (${id}) fired ${files.size} trigger events.`)
    }

    running = false
  }

  return { is_running, run }
}
