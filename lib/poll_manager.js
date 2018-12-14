const EventEmitter = require('events')

module.exports = (state, set, clear) => {
  const emitter = new EventEmitter()

  const add = (id, operation, delay) => {
    const next_poll = (poll, when = delay) => {
      state.set(id, set(poll, when))
    }

    const poll = async () => {
      // use removed id value to stop polling
      if (!state.get(id)) return

      try {
        await operation()
        if (state.get(id)) next_poll(poll)
      } catch(err) {
        remove(id)
        emitter.emit('error', id, err)
      }
    }

    next_poll(poll, 0)
  }

  const remove = id => {
    clear(state.get(id))
    state.delete(id)
  }

  return { add, remove, on: (evt, cb) => emitter.on(evt, cb) }
}
