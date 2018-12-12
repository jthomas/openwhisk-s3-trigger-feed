"use strict";

module.exports = (local, remote) => {
  const get = async key => {
    if (local.has(key)) return local.get(key)

    const value = await remote.get(key)
    local.set(key, value)

    return value
  }

  const set = async (key, value) => {
    local.set(key, value)
    await remote.set(key, value)
  }

  const del = async (key, value) => {
    local.del(key)
    await remote.del(key)
  }

  return { get, set, del }
}
