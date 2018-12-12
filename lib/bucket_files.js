"use strict";

module.exports = (client, bucket, logger) => {
  const file_changes = (previous, current) => {
    const changes = new Map()
    const deleted = new Map(previous)

    for (let [ name, etag ] of current) { 
      if (!previous.has(name)) {
        changes.set(name, 'added')
      } else {
        if (previous.get(name) !== etag) {
          changes.set(name, 'modified')
        } 
        deleted.delete(name)
      } 
    }

    for (let [ name ] of deleted) { 
      changes.set(name, 'deleted')
    }

    return changes
  }

  const etags = async () => {
    logger.info(`executing listObjects for bucket: ${bucket}`)
    const results = await client.listObjects({ Bucket: bucket }).promise()
    logger.debug(`listObjects response for bucket: ${bucket}`, results)
    const key_etags = results.Contents.map(file => [file.Key, file.ETag])
    logger.info(`listObjects returned ${results.Contents.length} for bucket: ${bucket}`)

    return new Map(key_etags)
  }

  return { file_changes, etags }
}
