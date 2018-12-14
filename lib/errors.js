module.exports.format = err => {
  const msg = err.message || 'unknown'
  const code = err.code || 'unknown'
  const response = `code: ${code}, message: ${msg}`
  return `s3 trigger feed: error returned accessing bucket => (${response})`
}
