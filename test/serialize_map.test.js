import test from 'ava'

const SerializeMap = require('../lib/serialize_map.js')
const crypto = require("crypto")

test('encoding and decoding map returns same values', t => {
  const entries = 1000
  const map = new Map()
  for (let idx = 0; idx < entries; idx++) {
    const key = crypto.randomBytes(20).toString('hex');
    const value = crypto.randomBytes(40).toString('hex');
    map.set(key, value)
  }

  const encoded = SerializeMap.encode(map)
  t.true(encoded instanceof Buffer)
  // gzip header bytes
  t.is(encoded[0], 31)
  t.is(encoded[1], 139)
  const decoded = SerializeMap.decode(encoded)
  t.deepEqual(decoded, map)
})
