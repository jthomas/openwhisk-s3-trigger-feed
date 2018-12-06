const zlib = require('zlib')

const serialize_map = map => JSON.stringify(Array.from(map.entries()))
const deserialize_map = json => (new Map(JSON.parse(json)))

const encode = input => zlib.gzipSync(serialize_map(input)) 
const decode = input => deserialize_map(zlib.gunzipSync(input))

module.exports = { encode, decode }
