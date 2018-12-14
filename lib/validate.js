const errors = require('./errors.js')

const FeedParameters = [ 'bucket', 's3_endpoint', 's3_apikey', 'interval' ]

module.exports = async (params, client) => {
  const valid = {}
  for (let param of FeedParameters) {
    if (!params.hasOwnProperty(param)) {
      throw new Error(`s3 trigger feed: missing ${param} parameter`)
    }
    valid[param] = params[param]
  }

  if (valid.interval < 1 || !Number.isInteger(valid.interval)) {
      throw new Error(`s3 trigger feed: invalid interval parameter`)
  }

  const s3 = new client({
    endpoint: valid.s3_endpoint, apiKeyId: valid.s3_apikey
  })

  try {
    await s3.listObjects({ Bucket: valid.bucket, MaxKeys: 0 }).promise()
    return valid 
  } catch (err) {
    const message = errors.format(err)
    throw new Error(message)
  }
}
