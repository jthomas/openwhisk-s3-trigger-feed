"use strict";

const errors = require('./errors.js')

module.exports = (client, bucket, logger) => {
  const lookup = files => new Map(files.map(file => [ file.Key, file ]))

  const file_changes = (previous, current) => {
    const changes = []
    const by_key = lookup(previous)

    for (let file of current) { 
      if (!by_key.has(file.Key)) {
        changes.push({ status: 'added', bucket: bucket, file })
      } else {
        if (by_key.get(file.Key).ETag !== file.ETag) {
          changes.push({ status: 'modified', bucket: bucket, file })
        }
        by_key.delete(file.Key)
      } 
    }

    for (let [ name, file ] of by_key) { 
      changes.push({ status: 'deleted', bucket: bucket, file })
    }

    return changes
  }

  const current = async () => {
    try {
      logger.info(`executing listObjects for bucket: ${bucket}`)
      const results = await client.listObjects({ Bucket: bucket }).promise()
      logger.debug(`listObjects response for bucket: ${bucket}`, results)
      logger.info(`listObjects returned ${results.Contents.length} for bucket: ${bucket}`)
      return results.Contents
    } catch (err) {
      logger.debug(`listObjects returned error`, err)
      const message = errors.format(err)
      throw new Error(message)
    }
  }

  return { file_changes, current }
}
