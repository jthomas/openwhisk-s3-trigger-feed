module.exports = (queue, trigger, ow) => {
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
      const requests = []
      for (let [name, status] of files) { 
        requests.push(ow.triggers.invoke({name: trigger, params: {name, status}}))
      }
      const results = await Promise.all(requests)
    }

    running = false
  }

  return { is_running, run }
}
