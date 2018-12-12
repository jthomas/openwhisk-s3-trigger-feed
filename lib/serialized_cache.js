"use strict";

module.exports = (cache, serialize) => {
  const get = async key => {
    const encoded = await cache.get(key)
    return encoded ? serialize.decode(encoded) : encoded
  }

  const set = async (key, value) => {
    await cache.set(key, serialize.encode(value))
  }

  const del = async (key) => {
    await cache.del(key)
  }

  return { get, set, del }
}
