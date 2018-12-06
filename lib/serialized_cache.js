"use strict";

module.exports = (cache, serialize) => {
  const get = async key => {
    const encoded = await cache.get(key)
    return encoded ? serialize.decode(encoded) : encoded
  }

  const set = async (key, value) => {
    await cache.set(key, serialize.encode(value))
  }

  return { get, set }
}
