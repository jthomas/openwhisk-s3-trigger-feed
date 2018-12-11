module.exports = (queue, operation) => {
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
      console.log('message from queue', files)
      const requests = []
      for (let [name, status] of files) { 
        console.log('firing async event', name, status)
        requests.push(operation({name, status}))
      }
      const results = await Promise.all(requests)
      console.log('fired all async events')
    }

    running = false
  }

  return { is_running, run }
}
