"use strict";

module.exports = client => {
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

  const etags = async bucket => {
    const results = await client.listObjects({ Bucket: bucket }).promise()
    const key_etags = results.Contents.map(file => [file.Key, file.ETag])

    return new Map(key_etags)
  }

  return { file_changes, etags }
}
