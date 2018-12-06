const redis = require('redis')
const URL = require('url').URL
const { promisify } = require('util')

const redis_client = url => {
  let client = redis.createClient(url, { return_buffers: true, tls: { servername: new URL(url).hostname} })

  client.on("error", function (err) {
    console.log("redis: error", err);
  });

  client.on("connect", function () {
    console.log("redis: connect");
  });

  client.on("reconnecting", function () {
    console.log("redis: reconnecting");
  });

  client.on("end", function () {
    console.log("redis: end");
  });

  client.on("ready", function () {
    console.log("redis: ready");
  });

  return client
}

module.exports = url => {
  const client = redis_client(url)

  const get = promisify(client.get).bind(client)
  const set = promisify(client.set).bind(client)

  return { get, set }
}
