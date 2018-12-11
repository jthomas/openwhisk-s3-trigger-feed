const EventEmitter = require('events')

const Queues = new Map()

class Queue extends EventEmitter {
  constructor () {
    super()
    this.queue = []
  }

  push (item) {
    this.queue.push(item)
    this.emit_async('message')
  }

  pop () {
    const item = this.queue.splice(0, 1)[0]
    if (!this.queue.length) this.emit_async('empty')

    return item
  }

  emit_async (event) {
    setImmediate(() => this.emit(event)) 
  }

  clear () {
    this.queue = []
  }
}

module.exports = id => {
  if (!Queues.has(id)) {
    Queues.set(id, new Queue())
  }

  return Queues.get(id)
}
