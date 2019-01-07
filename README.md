# Apache OpenWhisk S3 Event Provider

This is an Apache OpenWhisk trigger feed for an S3-compatible Object Store. It polls the bucket using the `ListObjects` API call to retrieve bucket files on a fixed interval. Changes to bucket files, as indicated by API responses, are fired as trigger events.

## usage

| Entity                                                 | Type | Parameters                               |
| ------------------------------------------------------ | ---- | ---------------------------------------- |
| `/james.thomas@uk.ibm.com_dev/s3-trigger-feed/changes` | feed | bucket, interval, s3_endpoint, s3_apikey |

- `bucket` is the bucket name.
- `interval` is the polling interval in minutes (minimum 1).
- `s3_endpoint` is the object store endpoint, e.g. `s3.eu-gb.objectstorage.softlayer.net`
- `s3_apikey` is the IAM API key for the object store service.

**This package is only currently available on the London region for testing. Please ensure you are logged into `api.eu-gb.bluemix.net`.**

### example

```
wsk trigger create test-s3-trigger --feed /james.thomas@uk.ibm.com_dev/s3-trigger-feed/changes --param bucket <BUCKET_NAME> --param interval <MINS> --param s3_endpoint <COS_ENDPOINT> --param s3_apikey <COS_KEY>
```

### trigger events

```
{"file":"<BUCKET_FILE_OBJECT>","status":"<added|deleted|modified>"}
```

#### example

```json
{
  "file": {
    "ETag": "\"fb47672a6f7c34339ca9f3ed55c6e3a9\"",
    "Key": "file-86.txt",
    "LastModified": "2018-12-19T08:33:27.388Z",
    "Owner": {
      "DisplayName": "80a2054e-8d16-4a47-a46d-4edf5b516ef6",
      "ID": "80a2054e-8d16-4a47-a46d-4edf5b516ef6"
    },
    "Size": 25,
    "StorageClass": "STANDARD"
  },
  "status": "deleted"
}
```

## limitations

- This event provider uses polling to monitor file changes to a bucket. Changes that occur between polls will not be registered, e.g. add and then remove a file within the polling interval. Changes that overlap will not be registered, multiple modifications to a file within the polling interval will only result in an event for the last modification.
- The `ListObjects` API lists a maximum of 1000 objects per bucket. If you have more files than this in the bucket, incorrect trigger events will be fired, i.e. removal events when files are still available.
- `ListObjects` incurs a GET request per polling interval. Polling once a minute will generate ~43830 requests per month. This is more than twice the free requests per month on the Lite tier (20,000 GET requests/month). This would cost 0.02 dollars per month on the paid `Cross Region Standard` plan.

## architecture

This event provider uses the "[Pluggable OpenWhisk Event Provider](https://github.ibm.com/thomas6/openwhisk-pluggable-provider)" to handle the trigger management around trigger feeds. The implementation of the event provider polls each bucket on an interval using the `ListObjects` [API call](https://docs.aws.amazon.com/AmazonS3/latest/API/v2-RESTBucketGET.html). Results are cached in Redis to allow comparison between calls. An internal memory-based queue is used to decouple polling operations from trigger firing.

### memory requirements

Bucket files (with ETags for comparison) need to be stored between polling requests. These values are stored as JavaScript arrays serialised to JSON and then compressed using GZIP. Binary strings are then stored directly in Redis.

Testing with 1000 random files, this uses ~90KB of memory per bucket in Redis. Polling 10,000 buckets of this size (1000 users with 10 buckets) would need about 900MB.

The application uses an in-memory LRU cache to reduce the amount of network requests to Redis. Cache eviction is based upon a maximum number of keys and defaults to 1000 buckets.

### resiliency

If the event provider crashes during polling it can re-read the previous bucket etags versions from Redis and trigger bucket information for Cloudant.

Bucket polling and trigger firing operations are de-coupled into different processes and joined by an in-memory queue. This allows the trigger firing to use exponential backoff to handle with trigger limits whilst not slowing down the polling operation. If the event provider crashes, untriggered file change events are currently lost. This could be changed to use Redis to improve the availability for this error case.

### running

See the "[Pluggable OpenWhisk Event Provider](https://github.ibm.com/thomas6/openwhisk-pluggable-provider)" docs on how to run this event provider. The following environment parameters are needed for this feed provider.

- `REDIS` - Redis URL string.
