"use strict";

const errors = require('./errors.js')

module.exports = (client, bucket, logger) => {
  const lookup = files => new Map(files.map(file => [ file.Key, file ]))
  const endpoint = client.config.endpoint

  const file_changes = (previous, current) => {
    const changes = []
    const by_key = lookup(previous)

    for (let file of current) { 
      if (!by_key.has(file.Key)) {
        changes.push({ status: 'added', bucket: bucket, endpoint: endpoint, key: file.Key, file })
      } else {
        if (by_key.get(file.Key).ETag !== file.ETag) {
          changes.push({ status: 'modified', bucket: bucket, endpoint: endpoint, key: file.Key, file })
        }
        by_key.delete(file.Key)
      } 
    }

    for (let [ name, file ] of by_key) { 
      changes.push({ status: 'deleted', bucket: bucket, endpoint: endpoint, key: file.Key, file })
    }

    return changes
  }

  const current = async () => {
    try {
        var params = { Bucket: bucket };
        var allObjectsRead = false;
        var objectsRead = new Array();
        logger.info(`executing listObjects for bucket: ${bucket}`);
        while (!allObjectsRead) {
            var results = await client.listObjectsV2(params).promise();
            results.Contents.forEach(element => {
                // Could delete non-essential properties from the data here
                // For example: element.StorageClass = null ;
                //
                // Could lower the memory footprint by converting the Timestamp to UTC millis
                //              element.LastModified = new Date(element.LastModified).getTime();
                objectsRead.push(element);
            });
            if (results.IsTruncated)
                params.ContinuationToken = results.NextContinuationToken;
            else
                allObjectsRead = true;
        }
        logger.debug(`listObjects response for bucket: ${bucket}`, results);
        logger.info(`listObjects returned ${objectsRead.length} for bucket: ${bucket}`)
        return objectsRead
    } catch (err) {
        //logger.debug(`listObjects returned error`, err)
        console.error(err);
        const message = errors.format(err)
        throw new Error(message)
    }
  }

  return { file_changes, current }
}
