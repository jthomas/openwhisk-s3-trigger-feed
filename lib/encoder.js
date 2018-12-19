const zlib = require('zlib')

const encode = input => zlib.gzipSync(JSON.stringify(input)) 
const decode = input => JSON.parse(zlib.gunzipSync(input))

module.exports = { encode, decode }
