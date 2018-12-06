module.exports = (state, set, clear) => {
  const add = (id, operation, delay) => {
    const next_poll = poll => {
      state.set(id, set(poll, delay))
    }

    const poll = async () => {
      // use removed id value to stop polling
      if (!state.get(id)) return

      try {
        await operation()
        if (state.get(id)) next_poll(poll)
      } catch(err) {
        console.log(err)
      }
    }

    next_poll(poll)
  }

  const remove = id => {
    clear(id)
    state.delete(id)
  }

  return { add, remove }
}
