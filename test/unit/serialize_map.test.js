import test from 'ava'

const Encoder = require('../../lib/encoder.js')
const crypto = require("crypto")

test('encoding and decoding array returns same values', t => {
  const entries = 1000
  const files = []
  for (let idx = 0; idx < entries; idx++) {
    const key = crypto.randomBytes(20).toString('hex');
    const value = crypto.randomBytes(40).toString('hex');
    files.push({ key, value })
  }

  const encoded = Encoder.encode(files)
  t.true(encoded instanceof Buffer)
  // gzip header bytes
  t.is(encoded[0], 31)
  t.is(encoded[1], 139)
  const decoded = Encoder.decode(encoded)
  t.deepEqual(decoded, files)
})
