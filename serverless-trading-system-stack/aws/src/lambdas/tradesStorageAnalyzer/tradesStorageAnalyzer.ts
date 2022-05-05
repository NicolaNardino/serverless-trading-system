import { S3Handler } from 'aws-lambda';
import { /*ListObjectsCommand, */HeadObjectCommand } from '../../layers/common/util/dependencies.js';
import { s3Client } from '/opt/nodejs/util/utils.js';

export const handler: S3Handler = async (event) => {
  console.log(JSON.stringify(event));
  const s3Bucket = event.Records[0].s3;
  const objectMetadata = (await s3Client.send(new HeadObjectCommand({Bucket: s3Bucket.bucket.name, Key: s3Bucket.object.key}))).Metadata;
  console.log('Object metadata ',objectMetadata);
  //console.log(await s3Client.send(new ListObjectsCommand({Bucket: s3Bucket.bucket.name})));
};